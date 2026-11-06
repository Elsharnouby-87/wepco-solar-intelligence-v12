/**
 * V6 source-basis electrical topology (conceptual route, NOT an as-built).
 * Sources: supplied EPROM ESP Solar Hybrid SLD and Huawei Operation Philosophy.
 * PV: DC array -> solar inverter -> AC LV distribution panel.
 * ESS: BESS integrated PCS <-> LV bus, direction reverses during charge.
 * DG: generator -> LV bus; ESP: LV bus -> VSD/well.
 * Curve endpoints are indicative visual locations only; no cable schedule is implied.
 */
export const FLOW_ROUTES = Object.freeze([
  {
    id: 'pv_dc',
    kind: 'dc',
    source: 'PV_ARRAY',
    target: 'SOLAR_INVERTER_DC',
    nominalKw: 450,
    glow: 0x42ceff,
    pts: [
      [13.3, 0.44, -23],
      [18.7, 0.44, -23],
      [18.7, 0.44, -8.2],
      [24.5, 0.44, -8.2],
      [24.5, 0.44, -6.4],
    ],
    drops: [
      [13.3, 1.22, -23],
      [24.5, 1.16, -6.4],
    ],
  },
  {
    id: 'pv_ac',
    kind: 'pvac',
    source: 'SOLAR_INVERTER_AC',
    target: 'LV_SWITCHGEAR',
    nominalKw: 450,
    glow: 0x75f3da,
    pts: [
      [24.5, 0.44, -3.55],
      [18.2, 0.44, -3.55],
      [18.2, 0.44, 2.8],
      [18.5, 0.44, 2.8],
    ],
    drops: [
      [24.5, 1.0, -3.55],
      [18.5, 1.12, 2.8],
    ],
  },
  {
    id: 'battery',
    kind: 'ess',
    source: 'BESS_PCS',
    target: 'LV_SWITCHGEAR',
    nominalKw: 324,
    glow: 0x5beec3,
    pts: [
      [35.1, 0.44, -14.8],
      [36.6, 0.44, -14.8],
      [36.6, 0.44, 1.3],
      [23.35, 0.44, 1.3],
      [23.35, 0.44, 2.55],
    ],
    drops: [
      [35.1, 1.2, -14.8],
      [23.35, 1.05, 2.55],
    ],
  },
  {
    id: 'generator',
    kind: 'ac',
    source: 'DIESEL_GENERATOR',
    target: 'LV_SWITCHGEAR',
    nominalKw: 250,
    glow: 0xffb366,
    pts: [
      [29, 0.44, 8.2],
      [29, 0.44, 5.75],
      [23.3, 0.44, 5.75],
      [23.3, 0.44, 3.65],
      [22.78, 0.44, 3.65],
    ],
    drops: [
      [29, 1.06, 8.2],
      [22.78, 1.12, 3.65],
    ],
  },
  {
    id: 'load',
    kind: 'load',
    source: 'LV_SWITCHGEAR',
    target: 'ESP_VSD',
    nominalKw: 250,
    glow: 0xd0f7ff,
    pts: [
      [20.6, 0.52, 4.45],
      [18.0, 0.52, 4.45],
      [18.0, 0.52, 21.4],
      [24, 0.52, 21.4],
      [24, 0.52, 24.8],
    ],
    drops: [
      [20.6, 1.15, 4.45],
      [24, 1.25, 24.8],
    ],
  },
]);

/** Power in modeled kW; PV DC values display AC-equivalent dispatch power, not
 * independently measured array terminal DC power (losses not resolved hourly).
 */
export function routePowerState(row) {
  const pv = Math.max(0, Number(row?.pvUsed) || 0);
  const charge = Math.max(0, Number(row?.charge) || 0);
  const discharge = Math.max(0, Number(row?.batteryToLoad) || 0);
  const generator = Math.max(0, Number(row?.genToLoad) || 0);
  const load = Math.max(0, Number(row?.loadKw) || 0);
  const charging = charge > 0.05;
  return {
    pv_dc: { kw: pv, color: 0x42ceff, direction: 1 },
    pv_ac: { kw: pv, color: 0x75f3da, direction: 1 },
    battery: {
      kw: discharge || charge,
      color: discharge > 0.05 ? 0x7ca5ff : 0x5beec3,
      direction: charging ? -1 : 1,
    },
    generator: { kw: generator, color: 0xffb366, direction: 1 },
    load: { kw: load, color: 0xd0f7ff, direction: 1 },
  };
}
export function lvActivePowerBalance(row) {
  const p = routePowerState(row);
  return (
    p.pv_ac.kw +
    p.generator.kw +
    (row?.batteryToLoad || 0) -
    (row?.charge || 0) -
    p.load.kw
  );
}
