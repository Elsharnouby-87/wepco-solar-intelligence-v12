import assert from 'node:assert/strict';
import { FIXED_SCENARIOS, sanitizeScenario, simulateV11Year, calculateV11Lifetime } from './js/v11-model.js';

for (const design of Object.values(FIXED_SCENARIOS)) {
  const result = simulateV11Year(design);
  assert.equal(result.rows.length, 8760);
  assert(result.annual.maxBalanceErrorKw < 1e-6);
  assert(result.annual.offHours > 0);
  assert(result.annual.offHours < 8760);
  assert(result.annual.fuelSavedLitres <= result.baselineFuelLitres);
  assert(result.annual.fuelSavedLitres > 0);
  for (const row of result.rows) {
    assert(row.soc >= .2 - 1e-6 && row.soc <= .9 + 1e-6);
    assert(row.pvAvailable >= row.solarToLoad + row.charge - 1e-6);
    assert(Math.abs(row.solarToLoad + row.batteryToLoad + row.genToLoad - row.loadKw) < 1e-6);
    if (row.dieselOn) assert.equal(row.solarToLoad, 0);
  }
}
const supplier = calculateV11Lifetime(FIXED_SCENARIOS.supplier);
assert.equal(supplier.npv, null, 'Unknown supplier quote must remain missing');
assert.equal(supplier.capex, null);
const fea = calculateV11Lifetime(FIXED_SCENARIOS.feasibility);
assert.equal(fea.rows.length, 25);
assert(Number.isFinite(fea.npv));
assert(fea.rows[12].replacement > 0);
assert(fea.rows[1].pvFactor < 1);
const custom = sanitizeScenario({ pvKwp: 700, bessKwh: 1100, capexUSD: 800000 });
assert.equal(custom.pvKwp, 700);
assert.equal(custom.capexUSD, 800000);
console.log('V11 advanced dispatch, CAPEX guardrail, annual physics and lifetime cashflows PASS');
