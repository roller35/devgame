import {
  getGroundNormal,
  getRoadSample,
  getTerrainHeight,
  PHEWA_LAKE_CENTER,
  PHEWA_LAKE_RADIUS,
  PHEWA_WATER_Y,
  WORLD_HALF_EXTENT,
} from './terrain';
import {
  BikePhysicsState,
  HandlingMode,
  MotorcycleSpecs,
  PhysicsInput,
  RiderState,
  RoadSurface,
  StuntEvent,
  WeatherMode,
} from './types';

export function createInitialBikeState(
  x: number,
  z: number,
  heading: number,
  specs: MotorcycleSpecs
): BikePhysicsState {
  const y = getTerrainHeight(x, z);
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading,
    speedMs: 0,
    leanAngle: 0,
    pitchAngle: 0,
    steerAngle: 0,
    gear: 1,
    rpm: specs.idleRpm,
    suspensionCompression: 0,
    grounded: true,
    airTime: 0,
    wheelieTime: 0,
    stoppieTime: 0,
    stuntCombo: 1,
    activeStuntLabel: '',
    activeStuntPoints: 0,
    fuelL: specs.fuelCapacityL,
    damage: 0,
    surface: getRoadSample(x, z).surface,
    wheelRotation: 0,
  };
}

export function createInitialRiderState(bike: BikePhysicsState): RiderState {
  return {
    onFoot: false,
    x: bike.x - Math.cos(bike.heading) * 1.4,
    y: bike.y,
    z: bike.z + Math.sin(bike.heading) * 1.4,
    heading: bike.heading,
    walkSpeed: 0,
    walkCycle: 0,
  };
}

export function computeSurfaceGrip(
  surface: RoadSurface,
  offroadGrip: number,
  weather: WeatherMode
): number {
  let base = 1.0;
  if (surface === 'asphalt') base = 1.0;
  else if (surface === 'bridge') base = 0.95;
  else if (surface === 'gravel') base = 0.62 + offroadGrip * 0.32;
  else if (surface === 'dirt') base = 0.56 + offroadGrip * 0.36;
  else base = 0.45 + offroadGrip * 0.42;

  if (weather === 'rain') {
    base *= surface === 'asphalt' ? 0.84 : 0.78;
  } else if (weather === 'mist') {
    base *= 0.94;
  }
  return Math.max(0.35, Math.min(1.05, base));
}

export interface PhysicsStepResult {
  completedStunt: StuntEvent | null;
  impactStrength: number;
}

export function stepBikePhysics(
  state: BikePhysicsState,
  input: PhysicsInput,
  specs: MotorcycleSpecs,
  options: {
    dt: number;
    handlingMode: HandlingMode;
    weather: WeatherMode;
    fuelEnabled: boolean;
    autoGear: boolean;
    shiftUpJustPressed: boolean;
    shiftDownJustPressed: boolean;
  }
): PhysicsStepResult {
  const dt = Math.min(Math.max(options.dt, 0.001), 0.05);
  let completedStunt: StuntEvent | null = null;
  let impactStrength = 0;

  const road = getRoadSample(state.x, state.z);
  state.surface = road.surface;
  const grip = computeSurfaceGrip(state.surface, specs.offroadGrip, options.weather);

  // Forward & right vectors in XZ plane (heading 0 -> -Z)
  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const fwdX = -sinH;
  const fwdZ = -cosH;
  const rightX = cosH;
  const rightZ = -sinH;

  // Decompose current horizontal velocity into forward and lateral components
  let fwdSpeed = state.vx * fwdX + state.vz * fwdZ;
  let latSpeed = state.vx * rightX + state.vz * rightZ;

  const hasFuel = !options.fuelEnabled || state.fuelL > 0.01;
  const effectiveThrottle = hasFuel ? Math.max(0, Math.min(1, input.throttle)) : 0;

  // Gear shifting
  const topSpeedMs = specs.topSpeedKmh / 3.6;
  if (options.autoGear) {
    const speedRatio = Math.max(0, fwdSpeed) / topSpeedMs;
    const idealGear = Math.max(
      1,
      Math.min(specs.gears, Math.floor(speedRatio * specs.gears) + 1)
    );
    state.gear = idealGear;
  } else {
    if (options.shiftUpJustPressed && state.gear < specs.gears) {
      state.gear += 1;
    }
    if (options.shiftDownJustPressed && state.gear > 1) {
      state.gear -= 1;
    }
  }

  // Gear ratio & RPM
  const gearBandMax = topSpeedMs * (state.gear / specs.gears);
  const gearFloor = state.gear === 1 ? 0 : topSpeedMs * ((state.gear - 1) / specs.gears) * 0.68;
  const bandRatio = Math.max(
    0,
    Math.min(1.1, (Math.max(0, fwdSpeed) - gearFloor) / Math.max(4, gearBandMax - gearFloor))
  );
  const targetRpm =
    specs.idleRpm +
    (specs.maxRpm - specs.idleRpm) * Math.max(bandRatio, effectiveThrottle * 0.25);
  state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * 10);

  // Acceleration & Braking when grounded
  if (state.grounded) {
    // Torque curve: stronger low-end torque in lower gears
    const gearTorqueMul = 1.15 - ((state.gear - 1) / specs.gears) * 0.45;
    const simScale = options.handlingMode === 'simulation' ? 0.94 : 1.04;
    const accelForce =
      effectiveThrottle *
      specs.maxPower *
      specs.torqueLow *
      gearTorqueMul *
      grip *
      simScale;

    if (fwdSpeed < topSpeedMs) {
      fwdSpeed += accelForce * dt;
    }

    // Reverse / braking
    const totalBrake = Math.min(1, input.brakeFront * 0.65 + input.brakeRear * 0.55);
    if (totalBrake > 0.02) {
      if (fwdSpeed > 0.4) {
        const decel = totalBrake * specs.brakePower * grip;
        fwdSpeed = Math.max(0, fwdSpeed - decel * dt);
      } else {
        // Gentle reverse walk-back with rear brake/reverse
        fwdSpeed = Math.max(-5.5, fwdSpeed - totalBrake * 9.5 * dt);
      }
    }

    // Aerodynamic drag & rolling resistance
    const dragCoeff = 0.0028;
    const rollingCoeff = state.surface === 'asphalt' ? 0.42 : 1.15;
    fwdSpeed -= (dragCoeff * fwdSpeed * Math.abs(fwdSpeed) + rollingCoeff * Math.sign(fwdSpeed)) * dt;
    if (Math.abs(fwdSpeed) < 0.08 && effectiveThrottle < 0.05 && totalBrake < 0.05) {
      fwdSpeed = 0;
    }

    // Steering & lean
    const speedFactor = Math.min(1, Math.abs(fwdSpeed) / 7.5);
    const highSpeedDamp = 1 - Math.min(0.55, (Math.abs(fwdSpeed) / topSpeedMs) * 0.48);
    const turnRate =
      -input.steer *
      specs.steeringResponse *
      speedFactor *
      highSpeedDamp *
      (fwdSpeed >= -0.1 ? 1 : -1) *
      (options.handlingMode === 'simulation' ? 0.88 : 1.0);

    state.heading += turnRate * dt;

    // Target lean angle based on steer & speed
    const maxLean = options.handlingMode === 'simulation' ? 0.72 : 0.62;
    const targetLean = input.steer * maxLean * speedFactor * Math.min(1, grip + 0.1);
    state.leanAngle += (targetLean - state.leanAngle) * Math.min(1, dt * 8.5);
    state.steerAngle += (input.steer * 0.42 - state.steerAngle) * Math.min(1, dt * 11);

    // Lateral tire grip eliminates sideways slide
    const latKill = options.handlingMode === 'simulation' ? grip * 9.5 : grip * 14.0;
    latSpeed *= Math.max(0, 1 - latKill * dt);

    // Wheelie & Stoppie pitch
    if (input.wheeliePull && effectiveThrottle > 0.45 && fwdSpeed > 3.5) {
      const targetPitch = 0.38 * specs.wheelieEase;
      state.pitchAngle += (targetPitch - state.pitchAngle) * Math.min(1, dt * 5.2);
      state.wheelieTime += dt;
      if (state.wheelieTime > 0.45) {
        state.activeStuntLabel = 'WHEELIE';
        state.activeStuntPoints = Math.round(state.wheelieTime * 180);
      }
    } else if (input.brakeFront > 0.6 && fwdSpeed > 6.5) {
      const targetPitch = -0.26;
      state.pitchAngle += (targetPitch - state.pitchAngle) * Math.min(1, dt * 6.0);
      state.stoppieTime += dt;
      if (state.stoppieTime > 0.35) {
        state.activeStuntLabel = 'STOPPIE';
        state.activeStuntPoints = Math.round(state.stoppieTime * 210);
      }
    } else {
      if (state.wheelieTime > 0.55) {
        completedStunt = {
          type: 'wheelie',
          label: `Wheelie ${state.wheelieTime.toFixed(1)}s`,
          points: Math.round(state.wheelieTime * 180) * state.stuntCombo,
          timestamp: Date.now(),
        };
      } else if (state.stoppieTime > 0.45) {
        completedStunt = {
          type: 'stoppie',
          label: `Stoppie ${state.stoppieTime.toFixed(1)}s`,
          points: Math.round(state.stoppieTime * 210) * state.stuntCombo,
          timestamp: Date.now(),
        };
      }
      state.wheelieTime = 0;
      state.stoppieTime = 0;
      if (state.airTime <= 0.1) {
        state.activeStuntLabel = '';
        state.activeStuntPoints = 0;
      }
      state.pitchAngle += (0 - state.pitchAngle) * Math.min(1, dt * 8.0);
    }
  } else {
    // Airborne controls
    state.airTime += dt;
    if (state.airTime > 0.25) {
      state.activeStuntLabel = 'BIG AIR';
      state.activeStuntPoints = Math.round(state.airTime * 320);
    }
    state.heading += -input.steer * 0.9 * dt;
    const airPitchInput = input.wheeliePull ? 0.9 : input.brakeFront > 0.4 ? -0.9 : 0;
    state.pitchAngle = Math.max(-0.55, Math.min(0.65, state.pitchAngle + airPitchInput * dt));
    state.leanAngle += (0 - state.leanAngle) * Math.min(1, dt * 3.0);
  }

  // Reconstruct world XZ velocity from updated heading
  const newSinH = Math.sin(state.heading);
  const newCosH = Math.cos(state.heading);
  const newFwdX = -newSinH;
  const newFwdZ = -newCosH;
  const newRightX = newCosH;
  const newRightZ = -newSinH;

  if (state.grounded) {
    state.vx = newFwdX * fwdSpeed + newRightX * latSpeed;
    state.vz = newFwdZ * fwdSpeed + newRightZ * latSpeed;
  }

  // Advance position
  const prevGroundY = getTerrainHeight(state.x, state.z);
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // World bounds soft bounce
  const limit = WORLD_HALF_EXTENT - 24;
  if (state.x < -limit) {
    state.x = -limit;
    state.vx = Math.abs(state.vx) * 0.35;
    impactStrength = 0.6;
  } else if (state.x > limit) {
    state.x = limit;
    state.vx = -Math.abs(state.vx) * 0.35;
    impactStrength = 0.6;
  }
  if (state.z < -limit) {
    state.z = -limit;
    state.vz = Math.abs(state.vz) * 0.35;
    impactStrength = 0.6;
  } else if (state.z > limit) {
    state.z = limit;
    state.vz = -Math.abs(state.vz) * 0.35;
    impactStrength = 0.6;
  }

  // Phewa Lake shallow water shoreline pushback so bike never sinks into void
  const lakeDx = state.x - PHEWA_LAKE_CENTER.x;
  const lakeDz = state.z - PHEWA_LAKE_CENTER.z;
  const lakeDist = Math.sqrt(lakeDx * lakeDx + lakeDz * lakeDz);
  const nextGroundY = getTerrainHeight(state.x, state.z);
  if (lakeDist < PHEWA_LAKE_RADIUS - 6 && nextGroundY < PHEWA_WATER_Y - 0.15) {
    const pushOut = (PHEWA_LAKE_RADIUS - 6) / Math.max(1, lakeDist);
    state.x = PHEWA_LAKE_CENTER.x + lakeDx * pushOut;
    state.z = PHEWA_LAKE_CENTER.z + lakeDz * pushOut;
    state.vx *= 0.45;
    state.vz *= 0.45;
  }

  const groundY = getTerrainHeight(state.x, state.z);
  const groundSlope = (groundY - prevGroundY) / Math.max(0.01, Math.hypot(state.vx, state.vz) * dt);

  // Vertical & airborne launch / landing
  if (state.grounded) {
    // Check if launching off a ramp or crest at speed
    const normal = getGroundNormal(state.x, state.z);
    const upVelFromSlope = (state.vx * -normal.nx + state.vz * -normal.nz) * 0.4;
    if (state.y - groundY > 0.42 && Math.hypot(state.vx, state.vz) > 10) {
      state.grounded = false;
      state.vy = Math.max(1.8, upVelFromSlope + groundSlope * 4.5);
    } else {
      state.y = groundY;
      state.vy = 0;
      const targetComp = Math.min(specs.suspensionTravel, Math.abs(groundSlope) * 0.15);
      state.suspensionCompression += (targetComp - state.suspensionCompression) * Math.min(1, dt * 12);
    }
  } else {
    state.vy -= 18.5 * dt; // Gravity
    state.y += state.vy * dt;

    if (state.y <= groundY) {
      const impactV = Math.abs(state.vy);
      state.y = groundY;
      state.vy = 0;
      state.grounded = true;
      state.suspensionCompression = Math.min(specs.suspensionTravel, impactV * 0.025);
      if (impactV > 6) {
        impactStrength = Math.min(1, impactV / 18);
      }
      if (state.airTime > 0.35) {
        completedStunt = {
          type: 'airtime',
          label: `Big Air ${state.airTime.toFixed(1)}s`,
          points: Math.round(state.airTime * 340) * state.stuntCombo,
          timestamp: Date.now(),
        };
      }
      state.airTime = 0;
      state.activeStuntLabel = '';
      state.activeStuntPoints = 0;
    }
  }

  // Update overall speed & wheel spin
  state.speedMs = Math.hypot(state.vx, state.vz);
  const wheelCircumference = 2 * Math.PI * 0.33;
  state.wheelRotation = (state.wheelRotation + (fwdSpeed * dt) / wheelCircumference * Math.PI * 2) % (Math.PI * 2);

  // Fuel consumption
  if (options.fuelEnabled && effectiveThrottle > 0.02) {
    const loadRate = 0.0022 * (0.4 + (state.rpm / specs.maxRpm) * 1.1) * effectiveThrottle;
    state.fuelL = Math.max(0, state.fuelL - loadRate * dt * 12);
  }

  return { completedStunt, impactStrength };
}

export function stepRiderOnFoot(
  rider: RiderState,
  input: { forward: number; strafe: number; sprint: boolean },
  dt: number
): void {
  const clampedDt = Math.min(dt, 0.05);
  const turnSpeed = 2.6;
  rider.heading -= input.strafe * turnSpeed * clampedDt;

  const sinH = Math.sin(rider.heading);
  const cosH = Math.cos(rider.heading);
  const targetSpeed = input.forward !== 0 ? (input.sprint ? 7.4 : 4.2) * input.forward : 0;
  rider.walkSpeed += (targetSpeed - rider.walkSpeed) * Math.min(1, clampedDt * 10);

  rider.x += -sinH * rider.walkSpeed * clampedDt;
  rider.z += -cosH * rider.walkSpeed * clampedDt;

  const limit = WORLD_HALF_EXTENT - 24;
  rider.x = Math.max(-limit, Math.min(limit, rider.x));
  rider.z = Math.max(-limit, Math.min(limit, rider.z));

  rider.y = getTerrainHeight(rider.x, rider.z);
  if (Math.abs(rider.walkSpeed) > 0.2) {
    rider.walkCycle += Math.abs(rider.walkSpeed) * clampedDt * 2.4;
  }
}
