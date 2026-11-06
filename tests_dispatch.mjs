import assert from 'node:assert/strict';
import { simulateYear, getIndex } from './js/dispatch.js';
for (const [name, expected] of [
  ['feasibility', 3385],
  ['supplier', 4038],
]) {
  const r = simulateYear(name, 165, 0.9);
  assert.equal(r.rows.length, 8760);
  assert.equal(r.annual.offHours, expected);
  assert.ok(r.annual.balanceErrorKw < 1e-6);
  for (const x of r.rows) {
    assert.ok(x.soc >= 0.2 - 1e-7 && x.soc <= 0.9 + 1e-7);
    assert.ok(x.pvAvailable >= 0 && x.curtailed >= 0 && x.batteryToLoad >= 0);
    assert.ok(
      Math.abs(x.solarToLoad + x.batteryToLoad + x.genToLoad - x.loadKw) < 1e-6
    );
    assert.ok(Math.abs(x.pvAvailable - x.pvUsed - x.curtailed) < 1e-6);
    assert.ok(!x.dieselOn || x.genToLoad === x.loadKw);
  }
}
assert.equal(getIndex(1, 1, 0), 0);
assert.equal(getIndex(12, 31, 23), 8759);
for (const load of [70, 120, 210, 250]) {
  assert.ok(simulateYear('feasibility', load).annual.balanceErrorKw < 1e-6);
}
console.log('All 8760-hour energy and SOC unit checks PASS.');
