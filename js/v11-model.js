import { WEATHER_ROWS } from './weather.js';

// V11 screening model. TMY inputs are representative, not on-site measurements.
// All electrical transitions are hourly conceptual dispatch, not a microgrid controls study.
export const V11_ASSUMPTIONS = Object.freeze({
  minSoc: 0.20,
  maxSoc: 0.90,
  reserveSoc: 0.05,
  roundTripEfficiency: 0.88,
  minGeneratorOnHours: 2,
  dieselBaselineLitresPerDay: 740,
  referenceLoadKw: 148.5,
  assumedNoLoadLitresPerHour: 8,
  startupFuelLitres: 0.75,
  emissionsKgPerLitre: 2.697196654576695,
  firstYearPVDegradation: 0.01,
  continuingPVDegradation: 0.0035,
  batteryAnnualCapacityFade: 0.02,
  batteryReplacementYear: 13
});

export const FIXED_SCENARIOS = Object.freeze({
  feasibility: { id: 'feasibility', name: 'EPROM feasibility', pvKwp: 304, bessKwh: 321, inverterKw: 300, pcsKw: 150, capexUSD: 485000, capacitySource: 'Feasibility spreadsheet; PCS screening assumption' },
  supplier: { id: 'supplier', name: 'EMDAD supplier', pvKwp: 456, bessKwh: 483.9, inverterKw: 450, pcsKw: 324, capexUSD: null, capacitySource: 'EMDAD SLD and Huawei datasheets; EPC quote pending' }
});

export function sanitizeScenario(input = {}) {
  const finite = (value, fallback, min, max) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    id: String(input.id || 'custom'),
    name: String(input.name || 'Custom screening design'),
    pvKwp: finite(input.pvKwp, 304, 10, 5000),
    bessKwh: finite(input.bessKwh, 321, 0, 20000),
    inverterKw: finite(input.inverterKw, 300, 10, 5000),
    pcsKw: finite(input.pcsKw, 150, 0, 5000),
    capexUSD: input.capexUSD === null || input.capexUSD === undefined || input.capexUSD === '' || Number(input.capexUSD) <= 0 ? null : finite(input.capexUSD, 0, 0, 100000000),
    capacitySource: input.capacitySource || 'Custom provisional input'
  };
}

export function estimatedDieselLitresPerHour(loadKw, params = {}) {
  const baseline = Math.max(0, Number(params.dieselBaselineLitresPerDay ?? V11_ASSUMPTIONS.dieselBaselineLitresPerDay)) / 24;
  const idle = Math.min(baseline, Math.max(0, Number(params.assumedNoLoadLitresPerHour ?? V11_ASSUMPTIONS.assumedNoLoadLitresPerHour)));
  const reference = Math.max(1, Number(params.referenceLoadKw ?? V11_ASSUMPTIONS.referenceLoadKw));
  return Math.max(0, idle + (baseline - idle) * Math.max(0, Number(loadKw) || 0) / reference);
}

export function simulateV11Year(scenario, settings = {}, returnRows = true) {
  const design = sanitizeScenario(scenario);
  const a = V11_ASSUMPTIONS;
  const loadKva = Math.max(0, Number(settings.loadKva ?? 165));
  const pf = Math.min(1, Math.max(0.7, Number(settings.pf ?? 0.9)));
  const loadKw = loadKva * pf;
  const pvFactor = Math.min(1.1, Math.max(0, Number(settings.pvFactor ?? 1)));
  const bessFactor = Math.min(1.1, Math.max(0.1, Number(settings.bessFactor ?? 1)));
  const efficiency = Math.min(0.99, Math.max(0.6, Number(settings.efficiency ?? a.roundTripEfficiency)));
  const eta = Math.sqrt(efficiency);
  const minSoc = a.minSoc;
  const maxSoc = a.maxSoc;
  const energyCapacity = design.bessKwh * bessFactor;
  const energyMin = energyCapacity * minSoc;
  const energyMax = energyCapacity * maxSoc;
  const reserve = energyCapacity * a.reserveSoc;
  let stored = energyMin;
  let on = true;
  let onStreak = a.minGeneratorOnHours;
  let starts = 0;
  const annual = {
    offHours: 0, onHours: 0, pvGrossKwh: 0, pvDeliveredKwh: 0,
    pvCurtailKwh: 0, solarDirectKwh: 0, bessChargeKwh: 0,
    bessDischargeKwh: 0, dieselKwh: 0, loadKwh: 0,
    fuelConsumedLitres: 0, fuelSavedLitres: 0, co2AvoidedTonnes: 0,
    gensetStarts: 0, renewableShare: 0, maxBalanceErrorKw: 0,
    worstSOC: 1, bestSOC: 0, minOffHoursAssured: false
  };
  const rows = returnRows ? [] : null;
  const operatingFuelLph = estimatedDieselLitresPerHour(loadKw, settings);
  const arrayFactor = design.pvKwp / 456;
  const pvAvailable = i => {
    const weather = WEATHER_ROWS[i];
    return Math.min(design.inverterKw, Math.max(0, weather[3]) * arrayFactor * pvFactor);
  };
  for (let i = 0; i < WEATHER_ROWS.length; i++) {
    const weather = WEATHER_ROWS[i];
    const [month, day, hour, , ghi, temperature] = weather;
    const pv = pvAvailable(i);
    // Temperature derating threshold is a screening assumption; check actual PCS firmware.
    const pcsDerate = temperature > 50 ? Math.max(0.8, 1 - (temperature - 50) * 0.02) : 1;
    const pcs = design.pcsKw * pcsDerate;
    const deliverable = Math.min(pcs, Math.max(0, stored - energyMin - reserve) * eta);
    const canCover = pv + deliverable + 1e-7 >= loadKw;
    // Do not stop the genset for a one-hour solar spike if the next hour fails.
    const nextPV = i + 1 < WEATHER_ROWS.length ? pvAvailable(i + 1) : 0;
    const hasNextHourCover = nextPV + Math.min(pcs, Math.max(0, stored - energyMin - reserve) * eta) + 1e-7 >= loadKw;
    const allowOff = canCover && (on ? onStreak >= a.minGeneratorOnHours && hasNextHourCover : true);
    const dieselOn = !allowOff;
    if (dieselOn && !on) starts += 1;
    if (dieselOn) onStreak = on ? onStreak + 1 : 1;
    else onStreak = 0;
    on = dieselOn;
    let solarToLoad = 0;
    let batteryToLoad = 0;
    let genToLoad = 0;
    let charge = 0;
    let curtail = 0;
    if (dieselOn) {
      genToLoad = loadKw;
      curtail = pv; // intentionally conservative zero-paralleling island assumption
      annual.onHours += 1;
      annual.fuelConsumedLitres += operatingFuelLph;
    } else {
      solarToLoad = Math.min(loadKw, pv);
      batteryToLoad = Math.max(0, loadKw - solarToLoad);
      stored = Math.max(energyMin, stored - batteryToLoad / eta);
      const extra = Math.max(0, pv - solarToLoad);
      charge = Math.min(extra, pcs, Math.max(0, (energyMax - stored) / eta));
      stored = Math.min(energyMax, stored + charge * eta);
      curtail = extra - charge;
      annual.offHours += 1;
    }
    annual.pvGrossKwh += pv;
    annual.pvDeliveredKwh += solarToLoad + charge;
    annual.pvCurtailKwh += curtail;
    annual.solarDirectKwh += solarToLoad;
    annual.bessChargeKwh += charge;
    annual.bessDischargeKwh += batteryToLoad;
    annual.dieselKwh += genToLoad;
    annual.loadKwh += loadKw;
    const mismatch = Math.abs(solarToLoad + batteryToLoad + genToLoad - loadKw);
    annual.maxBalanceErrorKw = Math.max(annual.maxBalanceErrorKw, mismatch);
    const soc = energyCapacity ? stored / energyCapacity : 0;
    annual.worstSOC = Math.min(annual.worstSOC, soc);
    annual.bestSOC = Math.max(annual.bestSOC, soc);
    if (rows) rows.push({
      i, month, day, hour, ghi, temperature, pvAvailable: pv,
      solarToLoad, batteryToLoad, genToLoad, charge, curtailed: curtail,
      soc, storedKwh: stored, loadKw, dieselOn
    });
  }
  annual.gensetStarts = starts;
  annual.fuelConsumedLitres += starts * Math.max(0, Number(settings.startupFuelLitres ?? a.startupFuelLitres));
  const baseline = operatingFuelLph * WEATHER_ROWS.length;
  annual.fuelSavedLitres = baseline - annual.fuelConsumedLitres;
  annual.co2AvoidedTonnes = annual.fuelSavedLitres * a.emissionsKgPerLitre / 1000;
  annual.renewableShare = annual.loadKwh > 0 ? (annual.solarDirectKwh + annual.bessDischargeKwh) / annual.loadKwh : 0;
  annual.minOffHoursAssured = false;
  return { design, annual, rows, baselineFuelLitres: baseline, loadKw };
}

function financialNpv(cashflows, discount) {
  return cashflows.reduce((acc, amount, i) => acc + amount / Math.pow(1 + discount, i), 0);
}

function financialIrr(cashflows) {
  if (cashflows[0] >= 0 || !cashflows.slice(1).some(n => n > 0)) return null;
  let low = -0.9;
  let high = 10;
  if (financialNpv(cashflows, low) * financialNpv(cashflows, high) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (financialNpv(cashflows, mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// 25-year TMY-repeat screening. PV 1% first-year loss followed by 0.35%
// nominal continuing degradation; battery fade and replacement percentages are
// separate user-editable engineering assumptions, not supplier guarantees.
export function calculateV11Lifetime(scenario, settings = {}) {
  const design = sanitizeScenario(scenario);
  const years = Math.min(40, Math.max(1, Number(settings.years ?? 25)));
  const capex = design.capexUSD === null ? null : design.capexUSD * Number(settings.fx ?? 55);
  const dieselPrice = Math.max(0, Number(settings.dieselPrice ?? 73.56));
  const escalation = Math.max(-0.5, Number(settings.escalation ?? 0.20));
  const discount = Math.max(0, Number(settings.discount ?? 0.18));
  const omRate = Math.max(0, Number(settings.omRate ?? 0.01));
  const omEscalation = Math.max(0, Number(settings.omEscalation ?? 0.08));
  const batteryFade = Math.min(0.1, Math.max(0, Number(settings.batteryFade ?? V11_ASSUMPTIONS.batteryAnnualCapacityFade)));
  const batteryReplaceYear = Math.max(0, Math.round(Number(settings.batteryReplaceYear ?? V11_ASSUMPTIONS.batteryReplacementYear)));
  const batteryReplaceCapexShare = Math.max(0, Number(settings.batteryReplaceCapexShare ?? 0.25));
  const rows = [];
  const cashflows = capex === null ? null : [-capex];
  let cumulative = capex === null ? null : -capex;
  let payback = null;
  let totalFuel = 0;
  let totalCarbon = 0;
  for (let year = 1; year <= years; year++) {
    const pvFactor = year === 1 ? 1 : (1 - V11_ASSUMPTIONS.firstYearPVDegradation) * Math.pow(1 - V11_ASSUMPTIONS.continuingPVDegradation, year - 2);
    const batteryAge = batteryReplaceYear > 1 ? (year - 1) % (batteryReplaceYear - 1) : year - 1;
    const bessFactor = Math.pow(1 - batteryFade, batteryAge);
    const sim = simulateV11Year(design, { ...settings, pvFactor, bessFactor }, false);
    const fuelPrice = dieselPrice * Math.pow(1 + escalation, year - 1);
    const gross = sim.annual.fuelSavedLitres * fuelPrice;
    const om = capex === null ? null : capex * omRate * Math.pow(1 + omEscalation, year - 1);
    const replacement = capex !== null && year === batteryReplaceYear && year > 1 ? capex * batteryReplaceCapexShare : 0;
    const net = capex === null ? null : gross - om - replacement;
    const previous = cumulative;
    if (net !== null) {
      cumulative += net;
      cashflows.push(net);
      if (payback === null && previous < 0 && cumulative >= 0 && net > 0) payback = year - 1 - previous / net;
    }
    totalFuel += sim.annual.fuelSavedLitres;
    totalCarbon += sim.annual.co2AvoidedTonnes;
    rows.push({
      year, pvFactor, bessFactor, offHours: sim.annual.offHours,
      fuelSavedLitres: sim.annual.fuelSavedLitres, co2AvoidedTonnes: sim.annual.co2AvoidedTonnes,
      pvGrossKwh: sim.annual.pvGrossKwh, pvCurtailKwh: sim.annual.pvCurtailKwh,
      fuelPrice, gross, om, replacement, net, cumulative
    });
  }
  return {
    design, capex, years, rows,
    npv: cashflows ? financialNpv(cashflows, discount) : null,
    irr: cashflows ? financialIrr(cashflows) : null,
    payback, totalFuel, totalCarbon,
    year1: rows[0], isCostVerified: false,
    modelDisclosure: 'TMY-repeat screening; fuel curve, O&M escalation, battery fade and replacement cost require vendor/field validation.'
  };
}