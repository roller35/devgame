import * as THREE from 'three';
import { createNumberPlateTexture, ProceduralTextureSet } from './textures';
import { BikeCustomization, MotorcycleSpecs } from './types';

export interface MotorcycleMeshRig {
  root: THREE.Group;
  chassis: THREE.Group;
  frontFork: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  headlightBeam: THREE.SpotLight | null;
  dispose: () => void;
}

export interface RiderMeshRig {
  root: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
}

function getWheelFinishMaterial(finish: BikeCustomization['wheelFinish']): THREE.MeshStandardMaterial {
  if (finish === 'gold') {
    return new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.85, roughness: 0.25 });
  }
  if (finish === 'black') {
    return new THREE.MeshStandardMaterial({ color: 0x1e2024, metalness: 0.55, roughness: 0.45 });
  }
  if (finish === 'chrome') {
    return new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.14 });
  }
  return new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.28 });
}

function buildWheel(radius: number, width: number, rimMat: THREE.Material): THREE.Group {
  const wheel = new THREE.Group();

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16171a,
    roughness: 0.88,
    metalness: 0.05,
  });
  const tireGeo = new THREE.TorusGeometry(radius - width * 0.28, width * 0.34, 14, 28);
  tireGeo.rotateY(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheel.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width * 0.45, 20, 1, true);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(rim);

  const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, width * 0.65, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  wheel.add(hub);

  // 6 spokes
  const spokeGeo = new THREE.BoxGeometry(0.025, radius * 1.25, 0.025);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i * Math.PI) / 3;
    wheel.add(spoke);
  }

  // Brake disc (perforated outer ring look so spokes stay crisp)
  const discMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.88, roughness: 0.25 });
  const discGeo = new THREE.TorusGeometry(radius * 0.34, 0.025, 8, 20);
  discGeo.rotateY(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.x = 0.075;
  wheel.add(disc);

  return wheel;
}

export function buildMotorcycleMesh(
  specs: MotorcycleSpecs,
  cust: BikeCustomization,
  textures: ProceduralTextureSet,
  enableSpotLight: boolean
): MotorcycleMeshRig {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);

  const isScooter = specs.category === 'scooter';
  const isDirt = specs.category === 'dirt' || specs.category === 'adventure';
  const isSport = specs.category === 'sport';
  const isClassic = specs.category === 'classic';

  const wheelRadius = isScooter ? 0.26 : isDirt ? 0.35 : 0.32;
  const wheelWidth = isSport ? 0.16 : 0.13;
  const wheelbase = isScooter ? 1.28 : isDirt ? 1.48 : 1.42;
  const frontZ = -wheelbase * 0.5;
  const rearZ = wheelbase * 0.5;

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cust.paintColor),
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e2228,
    metalness: 0.65,
    roughness: 0.48,
  });
  const engineMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.78,
    roughness: 0.38,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: isClassic ? 0x5c341d : 0x18181b,
    roughness: 0.86,
    metalness: 0.04,
  });
  const rimMat = getWheelFinishMaterial(cust.wheelFinish);
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: cust.exhaustStyle === 'carbon' ? 0x1f2429 : cust.exhaustStyle === 'chrome' ? 0xe2e8f0 : 0x94a3b8,
    metalness: cust.exhaustStyle === 'carbon' ? 0.25 : 0.92,
    roughness: cust.exhaustStyle === 'carbon' ? 0.42 : 0.16,
  });

  // Contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.95, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.02;
  contactShadow.scale.set(0.85, 1, 1.45);
  root.add(contactShadow);

  // Rear wheel & swingarm
  const rearWheel = buildWheel(wheelRadius, wheelWidth, rimMat);
  rearWheel.position.set(0, wheelRadius, rearZ);
  chassis.add(rearWheel);

  const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, wheelbase * 0.48), frameMat);
  swingarm.position.set(0, wheelRadius + 0.05, rearZ * 0.52);
  chassis.add(swingarm);

  // Rear suspension shock
  const shock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.35 })
  );
  shock.position.set(0, wheelRadius + 0.25, rearZ * 0.45);
  shock.rotation.x = 0.55;
  chassis.add(shock);

  // Engine block + cylinder fins
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.42), engineMat);
  engineBlock.position.set(0, wheelRadius + 0.18, 0.04);
  engineBlock.castShadow = true;
  chassis.add(engineBlock);

  const cylHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), engineMat);
  cylHead.position.set(0, wheelRadius + 0.36, -0.05);
  cylHead.rotation.x = -0.25;
  chassis.add(cylHead);

  // Main spine frame
  const frameBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, wheelbase * 0.65), frameMat);
  frameBeam.position.set(0, wheelRadius + 0.46, 0.02);
  chassis.add(frameBeam);

  // Sculpted fuel tank or scooter apron/floorboard
  if (isScooter) {
    const floorboard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.65), frameMat);
    floorboard.position.set(0, wheelRadius + 0.08, -0.1);
    chassis.add(floorboard);

    const rearBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.68), paintMat);
    rearBody.position.set(0, wheelRadius + 0.34, 0.36);
    rearBody.castShadow = true;
    chassis.add(rearBody);
  } else {
    // Tapered sculpted fuel tank via ExtrudeGeometry
    const tankShape = new THREE.Shape();
    tankShape.moveTo(-0.34, 0);
    tankShape.quadraticCurveTo(-0.38, 0.24, -0.08, 0.28);
    tankShape.quadraticCurveTo(0.24, 0.26, 0.34, 0.06);
    tankShape.lineTo(0.3, 0);
    tankShape.closePath();
    const tankGeo = new THREE.ExtrudeGeometry(tankShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    tankGeo.rotateY(-Math.PI / 2);
    tankGeo.center();
    const tank = new THREE.Mesh(tankGeo, paintMat);
    tank.position.set(0, wheelRadius + (isDirt ? 0.62 : 0.56), -0.18);
    tank.castShadow = true;
    chassis.add(tank);

    if (isSport) {
      // Aerodynamic side fairings
      const fairingGeo = new THREE.BoxGeometry(0.42, 0.38, 0.62);
      const fairing = new THREE.Mesh(fairingGeo, paintMat);
      fairing.position.set(0, wheelRadius + 0.42, -0.26);
      fairing.castShadow = true;
      chassis.add(fairing);
    }
  }

  // Ergonomic sculpted seat + tail cowl
  const seatGeo = new THREE.CapsuleGeometry(0.11, isDirt ? 0.46 : 0.38, 6, 12);
  seatGeo.rotateX(Math.PI / 2);
  seatGeo.scale(1.15, 0.58, 1);
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.set(0, wheelRadius + (isDirt ? 0.54 : 0.48), 0.28);
  seat.rotation.x = 0.08;
  seat.castShadow = true;
  chassis.add(seat);

  // Exhaust pipe (TubeGeometry sweeping along right side)
  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, wheelRadius + 0.26, -0.14),
    new THREE.Vector3(0.2, wheelRadius + 0.05, 0.05),
    new THREE.Vector3(0.21, wheelRadius + 0.08, 0.42),
    new THREE.Vector3(0.22, wheelRadius + (isDirt ? 0.36 : 0.18), rearZ + 0.12),
  ]);
  const pipeGeo = new THREE.TubeGeometry(exhaustCurve, 18, 0.032, 10, false);
  const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
  pipe.castShadow = true;
  chassis.add(pipe);

  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.36, 12), exhaustMat);
  muffler.rotation.x = Math.PI / 2 - (isDirt ? 0.35 : 0.14);
  muffler.position.set(0.22, wheelRadius + (isDirt ? 0.36 : 0.2), rearZ + 0.06);
  chassis.add(muffler);

  // Rear fender + tail light + Nepali license plate
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.34), frameMat);
  rearFender.position.set(0, wheelRadius + 0.45, rearZ + 0.06);
  rearFender.rotation.x = -0.35;
  chassis.add(rearFender);

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.04), brakeLightMat);
  tailLight.position.set(0, wheelRadius + 0.49, rearZ + 0.12);
  chassis.add(tailLight);

  const plateTex = createNumberPlateTexture(cust.plateText);
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), plateMat);
  plate.position.set(0, wheelRadius + 0.37, rearZ + 0.22);
  plate.rotation.y = Math.PI;
  plate.rotation.x = 0.22;
  chassis.add(plate);

  // Front fork assembly (rotates with steerAngle)
  const frontFork = new THREE.Group();
  frontFork.position.set(0, wheelRadius + 0.56, frontZ + 0.16);
  chassis.add(frontFork);

  const forkRake = 0.28;
  const forkLen = isDirt ? 0.74 : 0.66;
  const forkTubeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.18 });
  const forkTubeGeo = new THREE.CylinderGeometry(0.026, 0.024, forkLen, 10);

  const leftFork = new THREE.Mesh(forkTubeGeo, forkTubeMat);
  leftFork.position.set(-0.12, -forkLen * 0.4, -0.06);
  leftFork.rotation.x = -forkRake;
  frontFork.add(leftFork);

  const rightFork = new THREE.Mesh(forkTubeGeo, forkTubeMat);
  rightFork.position.set(0.12, -forkLen * 0.4, -0.06);
  rightFork.rotation.x = -forkRake;
  frontFork.add(rightFork);

  // Front wheel attached at bottom of fork
  const frontWheel = buildWheel(wheelRadius, wheelWidth * 0.9, rimMat);
  frontWheel.position.set(0, -0.56, -0.16);
  frontFork.add(frontWheel);

  // Front mudguard
  const mudguard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.32), paintMat);
  mudguard.position.set(0, isDirt ? -0.12 : -0.25, -0.14);
  mudguard.rotation.x = 0.18;
  frontFork.add(mudguard);

  // Handlebars + grips + mirrors + speedo dial
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.68, 10), frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.08, 0.02);
  frontFork.add(bar);

  const gripMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const leftGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), gripMat);
  leftGrip.rotation.z = Math.PI / 2;
  leftGrip.position.set(-0.3, 0.08, 0.02);
  frontFork.add(leftGrip);

  const rightGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), gripMat);
  rightGrip.rotation.z = Math.PI / 2;
  rightGrip.position.set(0.3, 0.08, 0.02);
  frontFork.add(rightGrip);

  // Mirrors
  const mirrorStemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
  const mirrorHeadGeo = new THREE.BoxGeometry(0.1, 0.06, 0.02);
  for (const side of [-1, 1]) {
    const stem = new THREE.Mesh(mirrorStemGeo, frameMat);
    stem.position.set(side * 0.24, 0.16, 0.0);
    stem.rotation.z = -side * 0.35;
    frontFork.add(stem);
    const mirror = new THREE.Mesh(mirrorHeadGeo, frameMat);
    mirror.position.set(side * 0.28, 0.24, 0.0);
    frontFork.add(mirror);
  }

  // Dashboard cluster (visible in First-Person camera!)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.07), frameMat);
  dash.position.set(0, 0.07, -0.07);
  dash.rotation.x = -0.6;
  frontFork.add(dash);

  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.015, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.65 })
  );
  dial.position.set(0, 0.095, -0.06);
  dial.rotation.x = Math.PI / 2 - 0.6;
  frontFork.add(dial);

  // Headlight housing + lens
  const headColor =
    cust.headlightTint === 'xenon' ? 0xdbeafe : cust.headlightTint === 'amber' ? 0xfde68a : 0xfef3c7;
  const headlightMat = new THREE.MeshStandardMaterial({
    color: headColor,
    emissive: new THREE.Color(headColor),
    emissiveIntensity: 1.3,
    roughness: 0.15,
  });
  const headHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.12, 16), frameMat);
  headHousing.rotation.x = Math.PI / 2;
  headHousing.position.set(0, -0.02, -0.11);
  frontFork.add(headHousing);

  const headLens = new THREE.Mesh(new THREE.CircleGeometry(0.078, 16), headlightMat);
  headLens.position.set(0, -0.02, -0.172);
  headLens.rotation.y = Math.PI;
  frontFork.add(headLens);

  let headlightBeam: THREE.SpotLight | null = null;
  if (enableSpotLight) {
    headlightBeam = new THREE.SpotLight(headColor, 18, 55, Math.PI / 5, 0.45, 1.5);
    headlightBeam.position.set(0, -0.02, -0.2);
    headlightBeam.target.position.set(0, -1.5, -18);
    frontFork.add(headlightBeam);
    frontFork.add(headlightBeam.target);
  }

  return {
    root,
    chassis,
    frontFork,
    frontWheel,
    rearWheel,
    brakeLightMat,
    headlightMat,
    headlightBeam,
    dispose: () => {
      plateTex.dispose();
    },
  };
}

export function buildRiderMesh(): RiderMeshRig {
  const root = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.68, metalness: 0.12 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.85 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.55 });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.18,
    metalness: 0.25,
    clearcoat: 0.9,
  });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x090d14, metalness: 0.9, roughness: 0.1 });

  const torso = new THREE.Group();
  torso.position.set(0, 0.88, 0);
  root.add(torso);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 6, 12), jacketMat);
  chest.position.y = 0.22;
  chest.castShadow = true;
  torso.add(chest);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.09, 0.26), accentMat);
  stripe.position.y = 0.24;
  torso.add(stripe);

  // Head + Helmet
  const head = new THREE.Group();
  head.position.set(0, 0.54, 0);
  torso.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), helmetMat);
  helmet.scale.set(0.95, 1.05, 1.12);
  helmet.castShadow = true;
  head.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.09, 0.11), visorMat);
  visor.position.set(0, 0.01, -0.11);
  head.add(visor);

  // Arms
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.21, 0.36, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), jacketMat);
    upper.position.set(0, -0.12, -0.06);
    upper.rotation.x = 0.55;
    arm.add(upper);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 4, 8), jacketMat);
    fore.position.set(0, -0.22, -0.24);
    fore.rotation.x = 1.15;
    arm.add(fore);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), bootMat);
    glove.position.set(0, -0.24, -0.37);
    arm.add(glove);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm);
  torso.add(rightArm);

  // Legs
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 0.85, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.26, 4, 8), pantsMat);
    thigh.position.set(0, -0.18, 0);
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.26, 4, 8), pantsMat);
    shin.position.set(0, -0.46, 0);
    leg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), bootMat);
    boot.position.set(0, -0.66, -0.04);
    leg.add(boot);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  root.add(leftLeg);
  root.add(rightLeg);

  return { root, torso, leftArm, rightArm, leftLeg, rightLeg, head };
}

export type TrafficKind = 'microbus' | 'truck' | 'bus' | 'car';

export function buildTrafficVehicle(
  kind: TrafficKind,
  textures: ProceduralTextureSet
): THREE.Group {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 16),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.8 });

  if (kind === 'microbus') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 1.55, 4.1),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 })
    );
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.22, 4.12),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 })
    );
    stripe.position.y = 0.85;
    group.add(stripe);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.62, 0.08), glassMat);
    windshield.position.set(0, 1.38, -2.04);
    group.add(windshield);
  } else if (kind === 'truck') {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.85, 1.85),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 })
    );
    cab.position.set(0, 1.35, -1.75);
    cab.castShadow = true;
    group.add(cab);

    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.0, 3.7),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 })
    );
    cargo.position.set(0, 1.55, 1.1);
    cargo.castShadow = true;
    group.add(cargo);

    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 0.08), glassMat);
    wind.position.set(0, 1.68, -2.67);
    group.add(wind);
    shadow.scale.set(1.2, 1, 2.2);
  } else if (kind === 'bus') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 2.2, 6.8),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 })
    );
    body.position.y = 1.45;
    body.castShadow = true;
    group.add(body);

    const winBand = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.72, 6.1), glassMat);
    winBand.position.set(0, 1.85, -0.1);
    group.add(winBand);
    shadow.scale.set(1.2, 1, 2.6);
  } else {
    const colors = [0xe2e8f0, 0x3b82f6, 0xef4444, 0x64748b];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.72, 3.8),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.4 })
    );
    lower.position.y = 0.65;
    lower.castShadow = true;
    group.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.56, 2.0), glassMat);
    cabin.position.set(0, 1.25, 0.15);
    group.add(cabin);
  }

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wx = kind === 'bus' || kind === 'truck' ? 1.02 : 0.82;
  const wz = kind === 'bus' ? 2.2 : 1.3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(sx * wx, 0.36, sz * wz);
      group.add(w);
    }
  }

  return group;
}
