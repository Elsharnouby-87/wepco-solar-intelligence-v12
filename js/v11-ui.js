import '../v11.css';
import { FIXED_SCENARIOS, sanitizeScenario, simulateV11Year, calculateV11Lifetime } from './v11-model.js';

// Self-contained V11 intelligence workspace. V10 display remains unchanged.
const node = id => document.getElementById(id);
const fmt = (n, digits = 0) => Number.isFinite(n) ? Number(n).toLocaleString('en-US', { minimumFractionDigits:digits, maximumFractionDigits:digits }) : '—';
const egp = n => Number.isFinite(n) ? 'EGP ' + fmt(n / 1000000, 2) + 'M' : 'CAPEX PENDING';
const pc = n => Number.isFinite(n) ? fmt(n * 100, 1) + '%' : '—';
const custom = { id:'custom', name:'Custom optimization', pvKwp:600, bessKwh:900, inverterKw:600, pcsKw:324 };
const quotes = { feasibility:485000, supplier:null, custom:null };
let selected = 'feasibility';
let modeled = null;
let yearly = null;
let redrawTimer = null;
const figures = {};

const page = [
  '<div class="v11-title"><div><span class="v11-overline">V11 · ENGINEERING INTELLIGENCE / 2026</span><h2>Powering oilfields with <em>decision intelligence.</em></h2>',
  '<p>Independent 8,760-hour dispatch, scenario comparisons, source-correct electrical topology, 25-year lifecycle finance and executive reporting.</p></div>',
  '<div class="v11-status"><i></i> MODELLED · NOT LIVE SCADA</div></div>',
  '<div class="v11-metrics">',
    '<article><span>GENSET OFF / YEAR</span><strong id="v11-off">—</strong><small id="v11-off-daily">Annual simulation</small></article>',
    '<article><span>DIESEL AVOIDED / YEAR*</span><strong id="v11-diesel">—</strong><small>Litres / calibrated proxy</small></article>',
    '<article><span>PV CURTAILMENT</span><strong id="v11-curtail">—</strong><small>MWh/year unused</small></article>',
    '<article class="v11-impact"><span>PROJECTED CO₂ AVOIDED*</span><strong id="v11-co2">—</strong><small>Tonnes/year · unverified</small></article>',
  '</div>',
  '<div class="v11-workspace">',
    '<aside class="v11-input-panel">',
      '<span class="v11-overline">01 / SCENARIO DESIGN STUDIO</span><h3>Technical specifications</h3>',
      '<label>SELECT CONFIGURATION<select id="v11-case"><option value="feasibility">304 kWp / 321 kWh · EPROM</option><option value="supplier">456 kWp / 483.9 kWh · EMDAD</option><option value="custom">Custom optimization</option></select></label>',
      '<div class="v11-two" id="v11-custom" hidden>',
        '<label>PV CAPACITY / kWp<input id="v11-pv" type="number" min="10" max="5000" step="10" value="600"></label>',
        '<label>BESS / kWh<input id="v11-bess" type="number" min="0" max="20000" step="10" value="900"></label>',
        '<label>INVERTERS / kW AC<input id="v11-inverters" type="number" min="10" max="5000" step="10" value="600"></label>',
        '<label>BESS PCS / kW AC<input id="v11-pcs" type="number" min="0" max="5000" step="10" value="324"></label>',
      '</div>',
      '<div class="v11-two">',
        '<label>ESP LOAD / kVA<input id="v11-load" type="number" min="70" max="250" step="5" value="165"></label>',
        '<label>POWER FACTOR<input id="v11-pf" type="number" min=".7" max="1" step=".01" value=".9"></label>',
        '<label>DIESEL PRICE EGP/L<input id="v11-price" type="number" min="0" max="1000" step=".5" value="73.56"></label>',
        '<label>FUEL ESCALATION %<input id="v11-escal" type="number" min="0" max="40" step="1" value="20"></label>',
        '<label>DISCOUNT RATE %<input id="v11-discount" type="number" min="0" max="50" step="1" value="18"></label>',
        '<label>EGP / USD<input id="v11-fx" type="number" min="1" max="300" step="1" value="55"></label>',
      '</div>',
      '<hr/><span class="v11-overline">02 / COMMERCIAL & LIFECYCLE</span><h3>Investment assumptions</h3>',
      '<label>THIS CONFIGURATION EPC / USD<input id="v11-capex" type="number" min="0" step="5000" value="485000" placeholder="EPC quote required"></label>',
      '<p id="v11-capex-note" class="v11-note">USD 485,000 is the 304 kWp feasibility input, not a supplier EPC quote.</p>',
      '<div class="v11-two">',
        '<label>ANNUAL O&M % CAPEX<input id="v11-om" type="number" min="0" max="20" step=".5" value="1"></label>',
        '<label>O&M ESCALATION %<input id="v11-omrise" type="number" min="0" max="40" value="8"></label>',
        '<label>BESS FADE %/YEAR<input id="v11-fade" type="number" min="0" max="10" step=".5" value="2"></label>',
        '<label>BESS REPLACE YEAR<input id="v11-replace" type="number" min="0" max="25" value="13"></label>',
        '<label>BESS REPLACE % CAPEX<input id="v11-replacecost" type="number" min="0" max="100" step="5" value="25"></label>',
        '<label>COMMERCIAL STRUCTURE<select id="v11-contract"><option value="epc">Owner EPC / 25Y</option><option value="ppa">PPA 5Y / remove assets</option><option value="boot">BOOT 5Y / transfer</option></select></label>',
      '</div>',
      '<div id="v11-contract-inputs" hidden>',
        '<label>OFFTAKE TARIFF / EGP PER kWh<input id="v11-tariff" type="number" min="0" step=".25" placeholder="Enter PPA tariff"></label>',
        '<label id="v11-boot-extra" hidden>YEAR 5 BUYOUT / EGP<input id="v11-buyout" type="number" min="0" step="10000" value="0"></label>',
        '<p class="v11-note">5Y off-taker view only; excludes taxes, network, financing, contractual availability and hidden charges.</p>',
      '</div>',
      '<button class="v11-button v11-reset" id="v11-reset">↺ RESET V11 ASSUMPTIONS</button>',
    '</aside>',
    '<div class="v11-panels">',
      '<section class="v11-card">',
        '<div class="v11-card-head"><div><span>OPERATING CONTROL ROOM</span><h3>24-hour power dispatch</h3></div><b id="v11-date">15 JUN · TMY</b></div>',
        '<div class="v11-legend"><i class="solar"></i>PV TO ESP <i class="battery"></i>BESS TO ESP <i class="diesel"></i>GENSET TO ESP <i class="unused"></i>CURTAILED</div>',
        '<svg id="v11-power" viewBox="0 0 770 213" role="img" aria-label="24 hour source power dispatch"></svg>',
        '<div class="v11-card-head v11-soc-head"><div><span>BATTERY RESERVE</span><h3>State of charge / energy security</h3></div><b id="v11-soc-text">—</b></div>',
        '<svg id="v11-soc" viewBox="0 0 770 118" role="img" aria-label="24 hour battery state of charge"></svg>',
        '<p id="v11-hour-info" class="v11-inline">Move the 3D time selector to inspect the same modeled interval.</p>',
      '</section>',
      '<section class="v11-card">',
        '<div class="v11-card-head"><div><span>SCENARIO COMPARISON</span><h3>Independent equipment configurations</h3></div><b class="v11-pill">8760 H / Y</b></div>',
        '<div class="v11-scroll"><table class="v11-table"><thead><tr><th>SCENARIO</th><th>PV / BESS</th><th>DG OFF</th><th>DIESEL AVOIDED*</th><th>CURTAILMENT</th><th>RENEWABLE SHARE</th><th>EPC</th></tr></thead><tbody id="v11-table"></tbody></table></div>',
        '<p class="v11-foot">*Avoided fuel is a provisional part-load/startup proxy calibrated to 740 L/day at 148.5 kW. OEM consumption curves, synchronizing hardware and safe transfers are not yet verified.</p>',
      '</section>',
      '<section class="v11-card">',
        '<div class="v11-card-head"><div><span>INVESTMENT INTELLIGENCE</span><h3 id="v11-finance-title">25-year degradation-aware economics</h3></div><b class="v11-pill" id="v11-cost-tag">SCREENING</b></div>',
        '<div class="v11-finance">',
          '<div><span>NPV</span><strong id="v11-npv">—</strong></div>',
          '<div><span>IRR</span><strong id="v11-irr">—</strong></div>',
          '<div><span>PAYBACK</span><strong id="v11-payback">—</strong></div>',
          '<div><span>YEAR 1 NET</span><strong id="v11-year1">—</strong></div>',
        '</div>',
        '<p class="v11-note" id="v11-finance-note">Screening only: annual PV degradation, BESS fade, replacement and inflation-sensitive O&M are modelled.</p>',
        '<div class="v11-chart-grid">',
          '<div><h4>Annual net cash flow / EGP million</h4><svg id="v11-cash" viewBox="0 0 780 164" role="img" aria-label="Annual net cash flow"></svg></div>',
          '<div><h4>NPV risk sensitivity / Tornado</h4><div id="v11-risk"></div></div>',
        '</div>',
      '</section>',
    '</div>',
  '</div>',
  '<section class="v11-card v11-electrical">',
    '<div class="v11-card-head"><div><span>INTERACTIVE ELECTRICAL SINGLE LINE</span><h3>Click equipment to locate it in the 3D environment</h3></div><b class="v11-pill">CONCEPTUAL</b></div>',
    '<div class="v11-scroll"><svg id="v11-sld" viewBox="0 0 1150 310" role="img" aria-label="Electrical sources and ESP linked by LV bus">',
      '<path d="M195 67 H280 M445 67 H560 V137 M433 236 H560 V137 M750 137 H970 M651 210 V169" stroke="#79e6d0" stroke-width="4" fill="none"/>',
      '<rect x="554" y="107" width="207" height="65" rx="9" fill="#8fe8c7"/><text x="658" y="145" text-anchor="middle" font-size="17" fill="#07302f" font-weight="900">LV AC BUS</text>',
      '<g data-v11-asset="pv" role="button" tabindex="0"><rect x="20" y="27" width="175" height="81" rx="12"/><text x="107" y="59" text-anchor="middle">JINKO PV ARRAY</text><text id="v11-pv-sld" x="107" y="84" text-anchor="middle">304 kWp / DC</text></g>',
      '<g data-v11-asset="pv" role="button" tabindex="0"><rect x="280" y="27" width="165" height="81" rx="12"/><text x="362" y="59" text-anchor="middle">PV INVERTER</text><text id="v11-inv-sld" x="362" y="84" text-anchor="middle">300 kW AC</text></g>',
      '<g data-v11-asset="bess" role="button" tabindex="0"><rect x="206" y="190" width="227" height="82" rx="12"/><text x="320" y="220" text-anchor="middle">BESS + PCS*</text><text id="v11-bess-sld" x="320" y="245" text-anchor="middle">321 kWh / 150 kW</text></g>',
      '<g data-v11-asset="genset" role="button" tabindex="0"><rect x="564" y="210" width="175" height="82" rx="12"/><text x="651" y="241" text-anchor="middle">CAT 3406C</text><text x="651" y="266" text-anchor="middle">DIESEL GENSET</text></g>',
      '<g data-v11-asset="esp" role="button" tabindex="0"><rect x="970" y="92" width="169" height="89" rx="12"/><text x="1054" y="123" text-anchor="middle">ESP / VSD</text><text id="v11-load-sld" x="1054" y="149" text-anchor="middle">148.5 kW</text></g>',
    '</svg></div>',
    '<p class="v11-foot">Functional topology from supplier SLD. Not an IFC or as-built drawing. Exact power controllers, PCS grid-forming, breaker interlocks, AVR/governor functions and safe transition times require vendor confirmation.</p>',
  '</section>',
  '<footer class="v11-report"><div><span>ENGINEERING GOVERNANCE / EXECUTIVE REPORTS</span><h3>Present the evidence, preserve the assumptions.</h3>',
    '<p>Representative PVGIS-TMY 2005–2023; location 29.8653°N, 28.5249°E. The 25Y model repeats representative weather with degradation; no certified performance, live telemetry, diesel fuel test or carbon-credit issuance.</p></div>',
    '<div><button class="v11-button" id="v11-export-year">↓ YEARLY CASHFLOW CSV</button><button class="v11-button" id="v11-export-hour">↓ HOURLY DISPATCH CSV</button><button class="v11-button" id="v11-print">↗ PRINT EXECUTIVE PDF</button></div>',
  '</footer>',
  '<p class="v11-disclaimer">PRELIMINARY SCREENING ONLY. Original V10 economics remain independent. Finance is disabled when scenario-specific EPC quotation is missing. Battery fade, lifecycle costs, diesel curve and contracting are explicitly provisional assumptions.</p>'
].join('\n');

function readNumber(id, fallback) {
  const value = node(id)?.value ?? '';
  if (value.trim() === '') return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
function settings() {
  return {
    loadKva:readNumber('v11-load', 165), pf:readNumber('v11-pf', .9),
    dieselPrice:readNumber('v11-price', 73.56),
    escalation:readNumber('v11-escal', 20) / 100,
    discount:readNumber('v11-discount', 18) / 100, fx:readNumber('v11-fx', 55),
    omRate:readNumber('v11-om', 1) / 100, omEscalation:readNumber('v11-omrise', 8) / 100,
    batteryFade:readNumber('v11-fade', 2) / 100,
    batteryReplaceYear:readNumber('v11-replace', 13),
    batteryReplaceCapexShare:readNumber('v11-replacecost', 25) / 100
  };
}
function design(id) {
  if (id !== 'custom') return sanitizeScenario({ ...FIXED_SCENARIOS[id], capexUSD:quotes[id] });
  return sanitizeScenario({
    ...custom, pvKwp:readNumber('v11-pv', 600), bessKwh:readNumber('v11-bess', 900),
    inverterKw:readNumber('v11-inverters', 600), pcsKw:readNumber('v11-pcs', 324),
    capexUSD:quotes.custom
  });
}
function text(id, value) { if (node(id)) node(id).textContent = value; }
function count(id, value, digits = 0) {
  if (!node(id) || !Number.isFinite(value)) return;
  const from = figures[id] ?? value;
  figures[id] = value;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { text(id, fmt(value, digits)); return; }
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / 550);
    text(id, fmt(from + (value - from) * (1 - Math.pow(1 - progress, 3)), digits));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function drawDay() {
  if (!modeled?.rows) return;
  const mo = Math.max(1, Math.min(12, Number(node('ctrl-month')?.value || 6)));
  const day = Math.max(1, Math.min(new Date(Date.UTC(2025, mo, 0)).getUTCDate(), Number(node('ctrl-day')?.value || 15)));
  const first = (Date.UTC(2025, mo - 1, day) - Date.UTC(2025, 0, 1)) / 86400000 * 24;
  const hours = modeled.rows.slice(first, first + 24);
  const current = Math.max(0, Math.min(23, Number(node('hour-range')?.value || 12)));
  const currentRow = hours[current];
  text('v11-date', day + ' ' + new Date(Date.UTC(2025, mo - 1, 1)).toLocaleString('en-US', { month:'short', timeZone:'UTC' }).toUpperCase() + ' / TMY');
  if (!currentRow) return;
  text('v11-soc-text', 'SOC ' + fmt(currentRow.soc * 100, 1) + '%');
  text('v11-hour-info', String(current).padStart(2, '0') + ':00 — PV ' + fmt(currentRow.solarToLoad, 1) + ' kW + BESS ' + fmt(currentRow.batteryToLoad, 1) + ' kW + DG ' + fmt(currentRow.genToLoad, 1) + ' kW = ' + fmt(currentRow.loadKw, 1) + ' kW / ' + (currentRow.dieselOn ? 'GENSET ON' : 'GENSET OFF'));
  const max = Math.max(1, ...hours.map(r => Math.max(r.loadKw, r.pvAvailable))) * 1.1;
  let power = '<line x1="20" y1="172" x2="760" y2="172" stroke="#577d86"/>';
  let soc = '';
  let points = [];
  hours.forEach((r, h) => {
    const x = 23 + h * 30.8;
    let y = 172;
    for (const [p, color] of [[r.genToLoad, '#e6b16c'], [r.solarToLoad, '#6de4c4'], [r.batteryToLoad, '#7cacf7']]) {
      const height = p / max * 139;
      y -= height;
      if (height > .1) power += '<rect x="' + x + '" y="' + y + '" width="20" height="' + height + '" rx="2" fill="' + color + '"/>';
    }
    const excess = Math.min(100, r.curtailed / max * 139);
    if (excess > 1) power += '<rect x="' + (x + 8) + '" y="' + Math.max(4, y - excess) + '" width="4" height="' + Math.min(excess, y - 4) + '" fill="#778790"/>';
    if (h % 4 === 0) power += '<text x="' + (x + 10) + '" y="196" text-anchor="middle" fill="#97b5b9" font-size="12">' + String(h).padStart(2, '0') + ':00</text>';
    if (r.dieselOn) soc += '<rect x="' + (x - 1) + '" y="8" width="27" height="92" fill="#e6b16c" opacity=".13"/>';
    points.push((x + 9).toFixed(1) + ',' + (100 - ((r.soc - .2) / .7) * 85).toFixed(1));
  });
  node('v11-power').innerHTML = power;
  node('v11-soc').innerHTML = soc + '<line x1="20" y1="100" x2="760" y2="100" stroke="#597e86"/><polyline points="' + points.join(' ') + '" stroke="#8cbefb" stroke-width="3" stroke-linejoin="round" fill="none"/><text x="717" y="115" fill="#9fbdc1" font-size="12">20% SOC</text>';
}
function drawCash(rows) {
  yearly = rows;
  if (!rows || !rows.length || rows[0].net == null) {
    node('v11-cash').innerHTML = '<text x="390" y="88" text-anchor="middle" fill="#d4aa7b" font-size="17">Enter EPC quotation / off-take tariff to unlock economics</text>';
    return;
  }
  const maximum = Math.max(1, ...rows.map(r => Math.abs(r.net / 1e6)));
  const width = 740 / rows.length;
  let svg = '<line x1="18" y1="90" x2="760" y2="90" stroke="#718d94"/>';
  rows.forEach((row, i) => {
    const value = row.net / 1e6;
    const height = Math.abs(value) / maximum * 73;
    const x = 20 + i * width;
    svg += '<rect x="' + x + '" y="' + (value >= 0 ? 90 - height : 90) + '" width="' + Math.max(8, width - 8) + '" height="' + height + '" rx="2" fill="' + (value >= 0 ? '#6cdbbc' : '#ecaf74') + '"/>';
    if (i === 0 || (i + 1) % 5 === 0) svg += '<text x="' + x + '" y="153" fill="#a5bbbf" font-size="12">Y' + (i + 1) + '</text>';
  });
  node('v11-cash').innerHTML = svg;
}
function risk(designSpec, input, base) {
  if (!Number.isFinite(base.npv)) {
    node('v11-risk').innerHTML = '<p class="v11-foot">Supplier/custom cost missing. Enter an EPC price for risk screening.</p>';
    return;
  }
  // Rebuild four pairs using the same annual deterioration model.
  const variations = [
    ['Diesel price ±20%', { dieselPrice:input.dieselPrice * .8 }, { dieselPrice:input.dieselPrice * 1.2 }],
    ['Diesel escalation ±5pp', { escalation:Math.max(0, input.escalation - .05) }, { escalation:input.escalation + .05 }],
    ['O&M rise ±5pp', { omEscalation:Math.max(0, input.omEscalation - .05) }, { omEscalation:input.omEscalation + .05 }],
    ['EPC cost ±20%', { capexUSD:designSpec.capexUSD * .8 }, { capexUSD:designSpec.capexUSD * 1.2 }]
  ];
  node('v11-risk').innerHTML = variations.map(([label, lo, hi]) => {
    const a = calculateV11Lifetime({ ...designSpec, capexUSD:lo.capexUSD ?? designSpec.capexUSD }, { ...input, ...lo }).npv;
    const b = calculateV11Lifetime({ ...designSpec, capexUSD:hi.capexUSD ?? designSpec.capexUSD }, { ...input, ...hi }).npv;
    const width = Math.min(100, Math.abs(b - a) / Math.max(1, Math.abs(base.npv)) * 130);
    return '<div class="v11-risk-row"><span>' + label + '</span><div><i style="width:' + width + '%"></i></div><b>' + fmt(Math.min(a, b) / 1e6) + '…' + fmt(Math.max(a, b) / 1e6) + ' M</b></div>';
  }).join('');
}
function ppaCase(active, input, type) {
  if (node('v11-tariff').value.trim() === '') return null;
  const tariff = Number(node('v11-tariff').value);
  if (!Number.isFinite(tariff) || tariff < 0) return null;
  let npv = 0;
  const rows = [];
  for (let year = 1; year <= 5; year++) {
    const factor = Math.pow(.99, year - 1); // provisional annual availability decay
    const avoidedCost = active.annual.fuelSavedLitres * factor * input.dieselPrice * Math.pow(1 + input.escalation, year - 1);
    const suppliedEnergy = (active.annual.solarDirectKwh + active.annual.bessDischargeKwh) * factor;
    const serviceFee = suppliedEnergy * tariff;
    const transfer = type === 'boot' && year === 5 ? readNumber('v11-buyout', 0) : 0;
    const net = avoidedCost - serviceFee - transfer;
    npv += net / Math.pow(1 + input.discount, year);
    rows.push({ year, gross:avoidedCost, om:serviceFee, replacement:transfer, net });
  }
  return { npv, rows };
}
function drawFinance(active, input) {
  const contract = node('v11-contract').value;
  if (contract !== 'epc') {
    const result = ppaCase(active, input, contract);
    text('v11-finance-title', contract === 'ppa' ? '5-year PPA · Off-taker perspective' : '5-year BOOT · Off-taker perspective');
    text('v11-cost-tag', 'CONTRACT INPUT REQUIRED');
    text('v11-npv', result ? egp(result.npv) : 'TARIFF PENDING');
    text('v11-irr', 'NOT APPLICABLE');
    text('v11-payback', 'NOT APPLICABLE');
    text('v11-year1', result ? egp(result.rows[0].net) : 'TARIFF PENDING');
    text('v11-finance-note', 'PPA/BOOT model: 5-year diesel expense avoided minus purchased renewable electricity; assumes no customer CAPEX, flat tariff, 1% annual availability reduction and PPA asset removal at expiry. Not contract-ready.');
    node('v11-risk').innerHTML = '<p class="v11-foot">PPA tariff, offtake metering, take-or-pay, asset removal, warranty, compensation and financing must be agreed before investment commitment.</p>';
    drawCash(result?.rows || null);
    return;
  }
  const result = calculateV11Lifetime(active.design, input);
  text('v11-finance-title', '25-year degradation-aware lifecycle cash flow');
  text('v11-cost-tag', result.capex === null ? 'QUOTE MISSING' : 'ASSUMPTION-BASED');
  text('v11-npv', egp(result.npv));
  text('v11-irr', result.irr === null ? 'NOT AVAILABLE' : pc(result.irr));
  text('v11-payback', result.payback === null ? 'NOT REACHED' : fmt(result.payback, 2) + ' years');
  text('v11-year1', result.year1.net === null ? 'CAPEX PENDING' : egp(result.year1.net));
  text('v11-finance-note', result.capex === null
    ? 'Supplier EPC cost has not been provided: NPV, IRR and payback are intentionally withheld. Original 304 kWp cost is NOT borrowed for this scope.'
    : 'Lifecycle screens: 1% PV first-year loss, then 0.35% annually; assumed BESS fade and replacement, annually escalated O&M, TMY-repeated physics. Diesel escalation is a scenario, NOT a forecast.');
  drawCash(result.rows);
  risk(active.design, input, result);
}
function update() {
  const input = settings();
  const results = ['feasibility', 'supplier', 'custom'].map(key => simulateV11Year(design(key), input, true));
  const active = results[['feasibility', 'supplier', 'custom'].indexOf(selected)];
  modeled = active;
  count('v11-off', active.annual.offHours);
  text('v11-off-daily', fmt(active.annual.offHours / 365, 2) + ' h/day · simulated');
  count('v11-diesel', active.annual.fuelSavedLitres);
  count('v11-curtail', active.annual.pvCurtailKwh / 1000, 1);
  count('v11-co2', active.annual.co2AvoidedTonnes, 1);
  node('v11-table').innerHTML = results.map(result => {
    const d = result.design;
    const a = result.annual;
    return '<tr' + (d.id === selected ? ' class="v11-selected"' : '') + '><td><b>' + d.name + '</b></td><td>' + fmt(d.pvKwp) + ' kWp / ' + fmt(d.bessKwh, 1) + ' kWh</td><td>' + fmt(a.offHours) + ' h</td><td>' + fmt(a.fuelSavedLitres) + ' L</td><td>' + fmt(a.pvCurtailKwh / 1000, 1) + ' MWh</td><td>' + pc(a.renewableShare) + '</td><td>' + (d.capexUSD === null ? '<b class="v11-warn">QUOTE MISSING</b>' : 'INPUT ONLY') + '</td></tr>';
  }).join('');
  text('v11-pv-sld', fmt(active.design.pvKwp) + ' kWp / DC');
  text('v11-inv-sld', fmt(active.design.inverterKw) + ' kW AC');
  text('v11-bess-sld', fmt(active.design.bessKwh, 1) + ' kWh / ' + fmt(active.design.pcsKw) + ' kW');
  text('v11-load-sld', fmt(active.loadKw, 1) + ' kW');
  drawDay();
  drawFinance(active, input);
}
function scheduleUpdate() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => {
    try { update(); } catch (e) { console.error('V11 update failed', e); text('v11-finance-note', 'Unable to update V11 model; inspect input ranges and retry.'); }
  }, 230);
}
function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const str = [keys.join(','), ...rows.map(row => keys.map(key => '"' + String(row[key] ?? '').replace(/"/g, '""') + '"').join(','))].join('\r\n');
  const blob = new Blob(['\ufeff', str], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function init() {
  const anchor = node('economics');
  if (!anchor) return;
  const section = document.createElement('section');
  section.className = 'v11-section container';
  section.id = 'v11';
  section.innerHTML = page;
  anchor.before(section);
  const nav = document.querySelector('.main-nav');
  if (nav) { const link = document.createElement('a'); link.href = '#v11'; link.textContent = 'V11 Intelligence'; nav.appendChild(link); }
  function switchDesign(id) {
    selected = id;
    node('v11-case').value = id;
    node('v11-custom').hidden = id !== 'custom';
    node('v11-capex').value = quotes[id] === null ? '' : String(quotes[id]);
    text('v11-capex-note', id === 'feasibility'
      ? 'USD 485,000 original 304 kWp feasibility input, NOT a signed EPC supplier quote.'
      : 'EPC price is not available for this configuration; enter your own quoted or explicitly indicative cost to unlock economics.');
    scheduleUpdate();
  }
  node('v11-case').addEventListener('change', event => switchDesign(event.target.value));
  node('v11-capex').addEventListener('input', event => { quotes[selected] = event.target.value.trim() === '' ? null : Math.max(0, Number(event.target.value)); scheduleUpdate(); });
  section.querySelectorAll('input,select').forEach(field => {
    if (field.id === 'v11-case' || field.id === 'v11-capex') return;
    const changed = () => {
      if (field.id === 'v11-contract') { node('v11-contract-inputs').hidden = field.value === 'epc'; node('v11-boot-extra').hidden = field.value !== 'boot'; }
      scheduleUpdate();
    };
    field.addEventListener('change', changed);
    field.addEventListener('input', changed);
  });
  ['ctrl-month', 'ctrl-day', 'hour-range'].forEach(id => {
    const control = node(id);
    if (control) { control.addEventListener('input', drawDay); control.addEventListener('change', drawDay); }
  });
  section.querySelectorAll('[data-v11-asset]').forEach(asset => {
    function inspect() {
      document.querySelector('[data-asset="' + asset.dataset.v11Asset + '"]')?.click();
      node('experience')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    asset.addEventListener('click', inspect);
    asset.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(); } });
  });
  node('v11-reset').addEventListener('click', () => {
    const defaults = {
      'v11-pv':600, 'v11-bess':900, 'v11-inverters':600, 'v11-pcs':324,
      'v11-load':165, 'v11-pf':.9, 'v11-price':73.56, 'v11-escal':20,
      'v11-discount':18, 'v11-fx':55, 'v11-om':1, 'v11-omrise':8,
      'v11-fade':2, 'v11-replace':13, 'v11-replacecost':25, 'v11-tariff':'', 'v11-buyout':0
    };
    Object.entries(defaults).forEach(([id, value]) => { node(id).value = String(value); });
    quotes.feasibility = 485000; quotes.supplier = null; quotes.custom = null;
    node('v11-contract').value = 'epc';
    node('v11-contract-inputs').hidden = true;
    switchDesign('feasibility');
  });
  node('v11-export-year').addEventListener('click', () => downloadCSV('WEPCO_V11_Yearly_Cashflow.csv', yearly));
  node('v11-export-hour').addEventListener('click', () => downloadCSV('WEPCO_V11_Hourly_Dispatch.csv', modeled?.rows));
  node('v11-print').addEventListener('click', () => window.print());
  scheduleUpdate();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
