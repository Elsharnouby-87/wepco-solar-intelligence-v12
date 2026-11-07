import { FIXED_SCENARIOS, sanitizeScenario, simulateV11Year } from './v11-model.js';

/**
 * Bridges the single 8760-hour V11 screening model into the existing
 * Three.js viewer's dispatch shape. The legacy physics module is retained
 * only for reproducibility of previously issued reference calculations.
 */
export function simulateForScene(visualMode='feasibility', loadKva=165, pf=.9, custom=null) {
  const design = custom
    ? sanitizeScenario({ ...custom, id:'custom' })
    : FIXED_SCENARIOS[visualMode] || FIXED_SCENARIOS.feasibility;
  const result = simulateV11Year(design, { loadKva, pf });
  const rows = result.rows.map(row => ({
    ...row,
    pvUsed: row.solarToLoad + row.charge,
    socKwh: row.storedKwh,
    batteryState: row.charge > .05 ? 'CHARGING'
      : row.batteryToLoad > .05 ? 'DISCHARGING' : 'STANDBY'
  }));
  return {
    design: design.id, loadKva, pf,
    config: design,
    rows,
    annual: {
      pvKwh: result.annual.pvGrossKwh,
      solarUsedKwh: result.annual.solarDirectKwh + result.annual.bessDischargeKwh,
      genKwh: result.annual.dieselKwh,
      offHours: result.annual.offHours,
      dieselAvoidedL: result.annual.fuelSavedLitres,
      curtailKwh: result.annual.pvCurtailKwh,
      chargeKwh: result.annual.bessChargeKwh,
      dischargeKwh: result.annual.bessDischargeKwh,
      balanceErrorKw: result.annual.maxBalanceErrorKw
    }
  };
}
