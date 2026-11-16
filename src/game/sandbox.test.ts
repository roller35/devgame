import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSaveData, parseSandboxCommand } from './sandbox';

test('sandbox commands validate bike ownership and arguments safely', () => {
  const help = parseSandboxCommand('help', ['himalayan_411']);
  assert.equal(help.type, 'help');

  const locked = parseSandboxCommand('spawn everest', ['himalayan_411']);
  assert.equal(locked.type, 'error');

  const unlocked = parseSandboxCommand('spawn everest', ['himalayan_411', 'everest_rr_650']);
  assert.equal(unlocked.type, 'spawn_bike');
  if (unlocked.type === 'spawn_bike') {
    assert.equal(unlocked.bikeId, 'everest_rr_650');
  }

  const tp = parseSandboxCommand('teleport pokhara', ['himalayan_411']);
  assert.equal(tp.type, 'teleport');
  if (tp.type === 'teleport') {
    assert.equal(tp.region, 'pokhara');
  }

  const weather = parseSandboxCommand('weather rain', ['himalayan_411']);
  assert.equal(weather.type, 'weather');

  const badMoney = parseSandboxCommand('money -500', ['himalayan_411']);
  assert.equal(badMoney.type, 'error');
});

test('save migration recovers safely from corrupt or partial save data', () => {
  const fromNull = migrateSaveData(null);
  assert.equal(fromNull.selectedBikeId, 'himalayan_411');
  assert.ok(fromNull.ownedBikeIds.includes('himalayan_411'));

  const fromPartial = migrateSaveData({
    moneyNpr: 42000,
    selectedBikeId: 'nonexistent_bike',
    ownedBikeIds: ['mustang_dirt_250'],
    customizations: {
      mustang_dirt_250: { plateText: 'ba 99 pa 1234' },
    },
  });

  assert.equal(fromPartial.moneyNpr, 42000);
  assert.ok(fromPartial.ownedBikeIds.includes('himalayan_411'));
  assert.ok(fromPartial.ownedBikeIds.includes('mustang_dirt_250'));
  assert.equal(fromPartial.selectedBikeId, 'himalayan_411');
  assert.equal(fromPartial.customizations.mustang_dirt_250.plateText, 'BA 99 PA 1234');
  assert.equal(fromPartial.version, 2);
  assert.equal(fromPartial.settings.touchControlsEnabled, true);

  const fromV2Off = migrateSaveData({
    version: 2,
    settings: { touchControlsEnabled: false },
  });
  assert.equal(fromV2Off.settings.touchControlsEnabled, false);
});
