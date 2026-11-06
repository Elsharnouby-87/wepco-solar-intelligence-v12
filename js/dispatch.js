import { WEATHER_ROWS, WEATHER_PROVENANCE } from './weather.js';

/** Energy conservation per 1h interval. Unit convention: kVA input × PF = kW.
 * Single-source island operation: genset ON -> PV curtailed; genset OFF -> PV/BESS.
 * This is a dispatch screening model, NOT protection coordination, a control proof,
 * battery warranty model, or a guarantee that the generator can be stopped.
 */
export const OP_ASSUMPTIONS = Object.freeze({
  pf: 0.9,
  minSoc: 0.2,
  maxSoc: 0.9,
  roundtripEfficiency: 0.88,
  loadKva: 165,
  sourcePvKwp: 456,
  startingSoc: 0.2,
  feasibility: { pvKwp: 304, bessKwh: 321, pcsKw: 150, inverterKw: 300 },
  supplier: { pvKwp: 456, bessKwh: 483.9, pcsKw: 324, inverterKw: 450 },
});
const batteryEta = Math.sqrt(OP_ASSUMPTIONS.roundtripEfficiency);
export { WEATHER_PROVENANCE };
export function simulateYear(design = 'feasibility', loadKva = 165, pf = 0.9) {
  if (!OP_ASSUMPTIONS[design]) design = 'feasibility';
  const conf = OP_ASSUMPTIONS[design];
  const load =
    Math.max(0, Math.min(500, Number(loadKva) || 0)) *
    Math.max(0.7, Math.min(1, Number(pf) || 0.9));
  const minEnergy = conf.bessKwh * OP_ASSUMPTIONS.minSoc;
  const maxEnergy = conf.bessKwh * OP_ASSUMPTIONS.maxSoc;
  let energy = conf.bessKwh * OP_ASSUMPTIONS.startingSoc;
  let yearPv = 0,
    yearServed = 0,
    yearOff = 0,
    yearDiesel = 0,
    yearCurtail = 0,
    yearCharge = 0,
    yearDischarge = 0;
  const result = [];
  let worstDeficit = 0;
  for (let i = 0; i < WEATHER_ROWS.length; i++) {
    const [month, day, hour, rawPv, ghi, temperature, wind] = WEATHER_ROWS[i];
    // Source PV output is modeled for 456 kWp and 450 kW inverter, corrected
    // conservatively to selected nominal array and inverter AC nameplate.
    const available = Math.min(
      conf.inverterKw,
      (Math.max(0, rawPv) * conf.pvKwp) / 456
    );
    const possibleDischarge = Math.min(
      conf.pcsKw,
      Math.max(0, energy - minEnergy) * batteryEta
    );
    const dieselOn = available + possibleDischarge + 1e-7 < load;
    let solarToLoad = 0,
      batteryToLoad = 0,
      genToLoad = 0,
      charge = 0,
      curtailed = 0;
    if (dieselOn) {
      // Explicit no-paralleling constraint: DG supplies full load and PV is curtailed.
      genToLoad = load;
      curtailed = available;
    } else {
      solarToLoad = Math.min(available, load);
      batteryToLoad = Math.max(0, load - solarToLoad);
      energy = Math.max(minEnergy, energy - batteryToLoad / batteryEta);
      const extra = Math.max(0, available - solarToLoad);
      charge = Math.min(
        extra,
        conf.pcsKw,
        Math.max(0, (maxEnergy - energy) / batteryEta)
      );
      energy = Math.min(maxEnergy, energy + charge * batteryEta);
      curtailed = extra - charge;
      yearOff += 1;
      yearServed += load;
    }
    yearPv += available;
    yearDiesel += genToLoad;
    yearCurtail += curtailed;
    yearCharge += charge;
    yearDischarge += batteryToLoad;
    result.push({
      i,
      month,
      day,
      hour,
      ghi,
      temperature,
      wind,
      pvAvailable: available,
      pvUsed: solarToLoad + charge,
      solarToLoad,
      batteryToLoad,
      genToLoad,
      charge,
      curtailed,
      soc: energy / conf.bessKwh,
      socKwh: energy,
      loadKw: load,
      dieselOn,
      batteryState:
        charge > 0.05
          ? 'CHARGING'
          : batteryToLoad > 0.05
            ? 'DISCHARGING'
            : 'STANDBY',
    });
    worstDeficit = Math.max(
      worstDeficit,
      Math.abs(solarToLoad + batteryToLoad + genToLoad - load)
    );
  }
  return {
    rows: result,
    design,
    loadKva,
    pf,
    config: conf,
    annual: {
      pvKwh: yearPv,
      solarUsedKwh: yearServed,
      genKwh: yearDiesel,
      offHours: yearOff,
      dieselAvoidedL: (yearOff * 740) / 24,
      curtailKwh: yearCurtail,
      chargeKwh: yearCharge,
      dischargeKwh: yearDischarge,
      balanceErrorKw: worstDeficit,
    },
  };
}
export function getIndex(month, day, hour) {
  const date = Date.UTC(2025, Number(month) - 1, Number(day));
  const first = Date.UTC(2025, 0, 1);
  return Math.max(
    0,
    Math.min(
      8759,
      Math.floor((date - first) / 86400000) * 24 +
        Math.floor(Math.max(0, Math.min(23, hour)))
    )
  );
}
