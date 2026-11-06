/* EPROM/WEPCO BED 1-17 — financial-model reconstruction.
 * Source: WEPCO ESP Offer(2).xlsx, 'Dashboard' and '25Y Cash Flow' worksheets.
 * This is a browser-side sensitivity model, not an operating dispatch simulation.
 */
(function () {
  'use strict';
  const BASE = Object.freeze({
    epcUSD: 485000,
    fx: 55,
    dieselPrice: 73.56,
    escalation: 0.2,
    gensetOffHours: 5.5,
    gensetRunHours: 24,
    baselineLitresPerDay: 740,
    daysPerYear: 365,
    omRate: 0.01,
    discount: 0.18,
    years: 25,
    emissionsKgPerLitre: 2.697196654576695,
  });
  function cashNpv(cashflows, rate) {
    return cashflows.reduce(
      (sum, flow, i) => sum + flow / Math.pow(1 + rate, i),
      0
    );
  }
  function irr(cashflows) {
    if (!(cashflows[0] < 0) || !cashflows.slice(1).some(x => x > 0))
      return null;
    let low = -0.95,
      high = 10;
    let lval = cashNpv(cashflows, low),
      hval = cashNpv(cashflows, high);
    if (!Number.isFinite(lval) || !Number.isFinite(hval) || lval * hval > 0)
      return null;
    for (let i = 0; i < 110; i++) {
      const mid = (low + high) / 2;
      const val = cashNpv(cashflows, mid);
      if (val > 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }
  function calculate(params = {}) {
    const p = { ...BASE, ...params };
    const capex = p.epcUSD * p.fx;
    const annualLitres =
      p.baselineLitresPerDay *
      (p.gensetOffHours / p.gensetRunHours) *
      p.daysPerYear;
    const yearOm = capex * p.omRate;
    const year1Gross = annualLitres * p.dieselPrice;
    const results = [];
    let cumulative = -capex,
      discounted = -capex,
      payback = null;
    const flows = [-capex];
    for (let year = 1; year <= p.years; year++) {
      const fuelPrice = p.dieselPrice * Math.pow(1 + p.escalation, year - 1);
      const gross = annualLitres * fuelPrice;
      const net = gross - yearOm;
      const previous = cumulative;
      cumulative += net;
      discounted += net / Math.pow(1 + p.discount, year);
      if (payback === null && previous < 0 && cumulative >= 0 && net > 0)
        payback = year - 1 - previous / net;
      flows.push(net);
      results.push({
        year,
        fuelPrice,
        gross,
        om: yearOm,
        net,
        cumulative,
        discounted,
      });
    }
    return {
      inputs: p,
      capex,
      annualLitres,
      yearOm,
      year1Gross,
      year1Net: year1Gross - yearOm,
      annualCo2t: (annualLitres * p.emissionsKgPerLitre) / 1000,
      lifetimeCo2t: ((annualLitres * p.emissionsKgPerLitre) / 1000) * p.years,
      annualOffHours: p.gensetOffHours * p.daysPerYear,
      lifetimeNetCash: cumulative,
      payback,
      irr: irr(flows),
      npv: discounted,
      results,
    };
  }
  const number = (v, digits = 0) =>
    Number.isFinite(v)
      ? new Intl.NumberFormat('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(v)
      : '—';
  const millions = (v, digits = 2) =>
    Number.isFinite(v) ? number(v / 1e6, digits) + 'M' : '—';
  window.WEPCO = { BASE, calculate, number, millions };
})();
