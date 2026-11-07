import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIXED_SCENARIOS, simulateV11Year, calculateV11Lifetime } from './js/v11-model.js';
import { simulateForScene } from './js/v13-adapter.js';

for (const mode of ['feasibility', 'supplier']) {
  const expected = simulateV11Year(FIXED_SCENARIOS[mode]);
  const scene = simulateForScene(mode, 165, 0.9);
  assert.equal(scene.rows.length, 8760);
  assert.equal(scene.annual.offHours, expected.annual.offHours);
  assert(Math.abs(scene.annual.dieselAvoidedL - expected.annual.fuelSavedLitres) < .0001);
  assert(Math.abs(scene.annual.curtailKwh - expected.annual.pvCurtailKwh) < .0001);
  assert(scene.annual.balanceErrorKw < 1e-6);
  for (const row of scene.rows) {
    assert(Math.abs(row.solarToLoad + row.batteryToLoad + row.genToLoad - row.loadKw) < 1e-6);
    assert(Math.abs(row.pvUsed - (row.solarToLoad + row.charge)) < 1e-6);
    assert(Math.abs(row.socKwh - row.storedKwh) < 1e-6);
    assert(row.batteryState === 'STANDBY' || row.batteryState === 'CHARGING' || row.batteryState === 'DISCHARGING');
  }
}
const custom = { id:'custom', pvKwp:600, bessKwh:900, inverterKw:600, pcsKw:324, capexUSD:null };
const customScene = simulateForScene('custom', 165, .9, custom);
const customV11 = simulateV11Year(custom);
assert.equal(customScene.annual.offHours, customV11.annual.offHours);
assert.equal(customScene.config.pvKwp, 600);
assert.equal(customScene.config.bessKwh, 900);
assert.equal(calculateV11Lifetime(FIXED_SCENARIOS.supplier).npv, null);
assert.equal(calculateV11Lifetime(custom).npv, null);
const shell = await readFile(new URL('./js/v13-shell.js', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('./js/v13.css', import.meta.url), 'utf8');
const main = await readFile(new URL('./js/main.js', import.meta.url), 'utf8');
const optimizer = await readFile(new URL('./js/v11-optimizer.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
assert(shell.includes('data-v13-go="explore"'));
assert(shell.includes('data-v13-go="performance"'));
assert(shell.includes('data-v13-go="investment"'));
assert(shell.includes('wepco:v11-updated'));
assert(shell.includes('wepco:asset-selected'));
assert(shell.includes('synchronizeScenario'));
assert(shell.includes('modeSet'));
assert(shell.includes('v13-print-report'));
assert(shell.includes('Technical details'));
assert(shell.includes('Quote required'));
assert(shell.includes('v13-metric-off'));
assert(stylesheet.includes('body[data-v13-mode="simple"]'));
assert(stylesheet.includes('body[data-v13-mode="advanced"]'));
assert(stylesheet.includes('prefers-reduced-motion'));
assert(stylesheet.includes('@media print'));
assert(main.includes("import './v13-shell.js';"));
assert(main.includes("import './v13-energy.js';"));
assert(main.includes("import { simulateForScene } from './v13-adapter.js';"));
assert(main.includes("wepco:scene-ready"));
assert(optimizer.includes("wepco:v13-visibility"), '64-case optimizer must be lazy');
assert(html.includes('id="three-canvas"'));
console.log('V13 executive UX structure and unified V11→3D physical dispatch PASS');
