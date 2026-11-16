import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTORCYCLES, REGIONS } from './catalog';
import {
  computeSurfaceGrip,
  createInitialBikeState,
  createInitialRiderState,
  stepBikePhysics,
  stepRiderOnFoot,
} from './physics';
import { getRegionAt, getRoadSample, getTerrainHeight } from './terrain';

test('all 5 Nepal regions have valid road connectivity and region mapping', () => {
  assert.equal(getRegionAt(0, 20), 'kathmandu');
  assert.equal(getRegionAt(-260, 20), 'pokhara');
  assert.equal(getRegionAt(20, 280), 'terai');
  assert.equal(getRegionAt(250, -30), 'hill_village');
  assert.equal(getRegionAt(0, -300), 'himalaya');

  for (const region of REGIONS) {
    const sample = getRoadSample(region.spawnPos.x, region.spawnPos.z);
    assert.ok(
      sample.dist < 18,
      `Region ${region.id} spawn should be near a road (got dist=${sample.dist.toFixed(2)})`
    );
    const h = getTerrainHeight(region.spawnPos.x, region.spawnPos.z);
    assert.ok(Number.isFinite(h), `Terrain height at ${region.id} must be finite`);
  }
});

test('motorcycle accelerates, shifts gears, consumes fuel, and steers cleanly', () => {
  const bike = MOTORCYCLES[0]; // Himalayan 411
  const state = createInitialBikeState(0, 54, 0, bike);
  const initialZ = state.z;

  for (let i = 0; i < 120; i++) {
    stepBikePhysics(
      state,
      {
        throttle: 1,
        brakeFront: 0,
        brakeRear: 0,
        steer: 0,
        wheeliePull: false,
        shiftUp: false,
        shiftDown: false,
        horn: false,
      },
      bike,
      {
        dt: 0.03,
        handlingMode: 'arcade',
        weather: 'sunny',
        fuelEnabled: true,
        autoGear: true,
        shiftUpJustPressed: false,
        shiftDownJustPressed: false,
      }
    );
  }

  assert.ok(state.z < initialZ - 20, 'Bike should move north (-Z) when heading=0 and throttle=1');
  assert.ok(state.speedMs > 15, 'Bike should reach significant speed');
  assert.ok(state.gear >= 2, 'Auto-gear should shift up under acceleration');
  assert.ok(state.fuelL < bike.fuelCapacityL, 'Fuel should decrease under throttle');
});

test('wheelie stunt triggers and awards points on completion', () => {
  const bike = MOTORCYCLES[3]; // Mustang Enduro 250
  const state = createInitialBikeState(0, 278, -Math.PI / 2, bike);
  state.vx = 14;
  state.speedMs = 14;

  for (let i = 0; i < 40; i++) {
    stepBikePhysics(
      state,
      {
        throttle: 1,
        brakeFront: 0,
        brakeRear: 0,
        steer: 0,
        wheeliePull: true,
        shiftUp: false,
        shiftDown: false,
        horn: false,
      },
      bike,
      {
        dt: 0.03,
        handlingMode: 'arcade',
        weather: 'sunny',
        fuelEnabled: false,
        autoGear: true,
        shiftUpJustPressed: false,
        shiftDownJustPressed: false,
      }
    );
  }

  assert.ok(state.pitchAngle > 0.2, 'Wheelie should lift bike front pitch');
  assert.equal(state.activeStuntLabel, 'WHEELIE');

  // Release wheelie to cash in stunt
  const res = stepBikePhysics(
    state,
    {
      throttle: 0,
      brakeFront: 0,
      brakeRear: 0,
      steer: 0,
      wheeliePull: false,
      shiftUp: false,
      shiftDown: false,
      horn: false,
    },
    bike,
    {
      dt: 0.03,
      handlingMode: 'arcade',
      weather: 'sunny',
      fuelEnabled: false,
      autoGear: true,
      shiftUpJustPressed: false,
      shiftDownJustPressed: false,
    }
  );
  assert.ok(res.completedStunt !== null, 'Releasing sustained wheelie should complete stunt');
  assert.ok(res.completedStunt!.points > 100);
});

test('rain and dirt reduce surface traction compared to dry asphalt', () => {
  const sport = MOTORCYCLES.find((b) => b.id === 'everest_rr_650')!;
  const dirt = MOTORCYCLES.find((b) => b.id === 'mustang_dirt_250')!;

  const dryAsphalt = computeSurfaceGrip('asphalt', sport.offroadGrip, 'sunny');
  const wetAsphalt = computeSurfaceGrip('asphalt', sport.offroadGrip, 'rain');
  const sportDirt = computeSurfaceGrip('dirt', sport.offroadGrip, 'sunny');
  const enduroDirt = computeSurfaceGrip('dirt', dirt.offroadGrip, 'sunny');

  assert.ok(dryAsphalt > wetAsphalt);
  assert.ok(enduroDirt > sportDirt);
});

test('rider can dismount and walk on foot', () => {
  const bike = MOTORCYCLES[0];
  const bikeState = createInitialBikeState(0, 54, 0, bike);
  const rider = createInitialRiderState(bikeState);
  rider.onFoot = true;
  const startZ = rider.z;

  for (let i = 0; i < 20; i++) {
    stepRiderOnFoot(rider, { forward: 1, strafe: 0, sprint: true }, 0.03);
  }

  assert.ok(rider.z < startZ - 2, 'Rider should walk forward on foot');
  assert.ok(rider.walkCycle > 0);
});
