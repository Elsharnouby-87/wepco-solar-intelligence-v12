import assert from 'node:assert/strict';
import { simulateYear, getIndex } from './js/dispatch.js';
import {
  FLOW_ROUTES,
  routePowerState,
  lvActivePowerBalance,
} from './js/topology.js';
const ids = FLOW_ROUTES.map(r => r.id);
assert.deepEqual(ids, ['pv_dc', 'pv_ac', 'battery', 'generator', 'load']);
assert(FLOW_ROUTES.every(r => r.pts.length >= 2 && r.source && r.target));
const a = simulateYear('feasibility', 165, 0.9);
assert.equal(a.rows.length, 8760);
let nChecked = 0,
  nCharging = 0,
  nDischarging = 0,
  nPv = 0,
  nDG = 0,
  maxError = 0;
for (const row of a.rows) {
  const power = routePowerState(row);
  const err = Math.abs(lvActivePowerBalance(row));
  maxError = Math.max(maxError, err);
  assert(err < 1e-5, `Bus failed hour ${row.i}: ${err}`);
  assert(Math.abs(power.pv_dc.kw - power.pv_ac.kw) < 1e-8);
  assert.equal(power.pv_ac.direction, 1);
  assert.equal(power.generator.direction, 1);
  assert.equal(power.load.direction, 1);
  assert(power.pv_dc.kw >= 0 && power.pv_ac.kw >= 0 && power.load.kw >= 0);
  if (row.dieselOn) {
    nDG++;
    assert(power.pv_ac.kw < 0.001, 'no PV/DG parallel');
    assert(power.generator.kw > 0);
  }
  if (row.charge > 0.05) {
    nCharging++;
    assert.equal(power.battery.direction, -1);
    assert.equal(power.battery.kw, row.charge);
  }
  if (row.batteryToLoad > 0.05) {
    nDischarging++;
    assert.equal(power.battery.direction, 1);
    assert.equal(power.battery.kw, row.batteryToLoad);
  }
  if (power.pv_ac.kw > 0.1) nPv++;
  nChecked++;
}
const june = a.rows[getIndex(6, 15, 12)],
  midnight = a.rows[getIndex(6, 15, 0)];
assert(june.pvUsed > 0, 'Solar available at 12:00');
assert(!june.dieselOn, 'solar island midday');
assert(midnight.dieselOn, 'diesel on at midnight');
assert.equal(routePowerState(midnight).pv_ac.kw, 0);
const b = simulateYear('supplier', 165, 0.9);
assert.equal(b.rows.length, 8760);
for (const row of b.rows) assert(Math.abs(lvActivePowerBalance(row)) < 1e-5);
// Verify 468 / 702 module counts and module face layout via geometry text source.
const sceneJs = await (
  await import('node:fs/promises')
).readFile(new URL('./js/scene.js', import.meta.url), 'utf8');
assert(
  /faceGeo\.rotateX\(\s*-Math\.PI\s*\/\s*2\s*\)/.test(sceneJs),
  'Panel face must be rotated into same XZ plane'
);
assert(/const\s+cols\s*=\s*mode\s*===\s*['\"]supplier['\"]\s*\?\s*54\s*:\s*39/.test(sceneJs));
assert(/const\s+rows\s*=\s*mode\s*===\s*['\"]supplier['\"]\s*\?\s*13\s*:\s*12/.test(sceneJs));
assert(
  /this\.applyFlowState\(\s*route\.id\s*,\s*flow\.kw\s*,\s*flow\.color\s*,\s*flow\.direction\s*\)/.test(sceneJs)
);
assert(!sceneJs.includes("this.applyFlowState('pv',pvKw"));
console.log(
  JSON.stringify(
    {
      pass: true,
      nChecked,
      nCharging,
      nDischarging,
      nPv,
      nDG,
      maxError,
      full_year_off: a.annual.offHours,
      avg: a.annual.offHours / 365,
      jun15noon: { pv: june.pvUsed, charge: june.charge, dg: june.genToLoad },
      supplier_off: b.annual.offHours,
    },
    null,
    2
  )
);
