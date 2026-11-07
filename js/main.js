import './finance.js';
import './v11-ui.js';
import './v11-optimizer.js';
import './v13-shell.js';
import './v13-energy.js';
import { simulateForScene } from './v13-adapter.js';
import {
  simulateYear,
  getIndex,
  OP_ASSUMPTIONS,
  WEATHER_PROVENANCE,
} from './dispatch.js';
const { BASE, calculate, number, millions } = window.WEPCO;
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const elem = (tag, attr = {}) => {
  const x = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) x.setAttribute(k, v);
  return x;
};
const nf = (v, places = 0) => number(v, places);
const fmtMoney = v => 'EGP ' + millions(v, 2);
const state = {
  price: BASE.dieselPrice,
  escalation: BASE.escalation,
  offtime: BASE.gensetOffHours,
  fx: BASE.fx,
  discount: BASE.discount,
  range: 10,
  design: 'feasibility',
  hour: 12,
  loadKva: 165,
  powerFactor: 0.9,
  month: 6,
  day: 15,
  tech: null,
  operatingResult: null,
  playing: false,
  paused3D: false,
  flowVisible: true,
  scene: null,
  model: calculate(),
  baseModel: calculate(),
};
const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;
function txt(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}
function formattedPayback(v) {
  return v === null ? 'Not reached' : nf(v, 2) + ' yrs';
}
function animateKpi(selector, raw, display, suffix) {
  const node = $(selector);
  if (!node) return;
  if (reducedMotion) {
    node.innerHTML = display + '<span>' + suffix + '</span>';
    return;
  }
  const old = Number(node.dataset.current || 0);
  node.dataset.current = raw;
  const start = performance.now(),
    duration = 500;
  function step(now) {
    const f = Math.min(1, (now - start) / duration),
      t = 1 - Math.pow(1 - f, 3);
    const val = old + (raw - old) * t;
    node.innerHTML = nf(val, 2) + '<span>' + suffix + '</span>';
    if (f < 1) requestAnimationFrame(step);
    else node.innerHTML = display + '<span>' + suffix + '</span>';
  }
  requestAnimationFrame(step);
}
function updateModel() {
  state.model = calculate({
    dieselPrice: state.price,
    escalation: state.escalation,
    gensetOffHours: state.offtime,
    fx: state.fx,
    discount: state.discount,
  });
  const m = state.model;
  txt('o-diesel', nf(state.price, 2));
  txt('o-offtime', nf(state.offtime, 1));
  txt('o-fx', nf(state.fx));
  txt('o-discount', nf(state.discount * 100));
  $('#o-escalation').innerHTML =
    nf(state.escalation * 100) + '%<span> / yr</span>';
  $$('[data-escalation]').forEach(b =>
    b.classList.toggle(
      'active',
      Number(b.dataset.escalation) === state.escalation
    )
  );
  animateKpi('[data-kpi="capex"]', m.capex / 1e6, nf(m.capex / 1e6, 2), ' M');
  const kpiPay = $('[data-kpi="payback"]');
  if (m.payback === null) kpiPay.innerHTML = 'N/A';
  else animateKpi('[data-kpi="payback"]', m.payback, nf(m.payback, 2), ' yr');
  const kpiIrr = $('[data-kpi="irr"]');
  if (m.irr === null) kpiIrr.innerHTML = 'N/A';
  else animateKpi('[data-kpi="irr"]', m.irr * 100, nf(m.irr * 100, 2), '%');
  animateKpi('[data-kpi="npv"]', m.npv / 1e6, nf(m.npv / 1e6, 2), ' M');
  txt('result-npv', fmtMoney(m.npv));
  txt('result-irr', m.irr === null ? 'N/A' : nf(m.irr * 100, 2) + '%');
  txt('result-payback', formattedPayback(m.payback));
  txt('result-year1', fmtMoney(m.year1Net));
  txt('result-fuel', nf(m.annualLitres) + ' L/yr');
  txt(
    'npv-trend',
    state.escalation === 0.2
      ? 'Base fuel escalation / ' + nf(state.discount * 100) + '% discount'
      : nf(state.escalation * 100) +
          '% fuel escalation / ' +
          nf(state.discount * 100) +
          '% discount'
  );
  txt('value-gross', fmtMoney(m.year1Gross));
  txt('value-om', fmtMoney(m.yearOm));
  txt('value-net', fmtMoney(m.year1Net));
  txt('impact-litres', nf(m.annualLitres));
  txt('impact-carbon', nf(m.annualCo2t));
  txt('impact-carbon-life', nf(m.lifetimeCo2t));
  txt('impact-hours', nf(m.annualOffHours, 1));
  txt('impact-ratio', nf((state.offtime / 24) * 100, 1) + '%');
  txt('impact-split', nf(state.offtime, 1) + 'h SOLAR/BESS WINDOW');
  txt('impact-off-day', nf(state.offtime, 1) + ' HR / DAY');
  $('#diesel-bar').style.width = nf((state.offtime / 24) * 100, 2) + '%';
  $$('[data-hour]').forEach(b =>
    b.classList.toggle(
      'avoided',
      !!state.tech?.rows?.[
        getIndex(state.month, state.day, Number(b.dataset.hour))
      ] &&
        !state.tech.rows[
          getIndex(state.month, state.day, Number(b.dataset.hour))
        ].dieselOn
    )
  );
  drawCashChart();
  drawDieselChart();
}
function initHoursGrid() {
  const g = $('#hours-grid');
  for (let i = 0; i < 24; i++) {
    const b = elem('span', { 'data-hour': String(i), 'aria-hidden': 'true' });
    g.appendChild(b);
  }
}
function svgText(x, y, text, other = '') {
  return `<text x="${x}" y="${y}" class="axis-label" ${other}>${text}</text>`;
}
function drawCashChart() {
  const svg = $('#chart-cashflow');
  const model = state.model;
  const years = state.range;
  const values = [
    { year: 0, cumulative: -model.capex },
    ...model.results.slice(0, years),
  ];
  const W = 800,
    H = 300,
    L = 71,
    R = 25,
    T = 19,
    B = 45;
  const min = Math.min(0, ...values.map(d => d.cumulative / 1e6)),
    max = Math.max(0, ...values.map(d => d.cumulative / 1e6));
  const minY = min - (max - min) * 0.08,
    maxY = max + (max - min) * 0.11;
  const x = yr => L + (yr / years) * (W - L - R),
    y = v => T + ((maxY - v) / (maxY - minY)) * (H - T - B);
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = minY + (maxY - minY) * (i / 4);
    const yy = y(v);
    grid += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>${svgText(L - 12, yy + 4, nf(v, 0), 'text-anchor="end"')}`;
  }
  for (let k = 0; k <= 5; k++) {
    const yr = (years / 5) * k;
    grid += svgText(x(yr), H - 18, nf(yr, 0), 'text-anchor="middle"');
  }
  const points = values.map(d => [x(d.year), y(d.cumulative / 1e6)]);
  const path = points
    .map(([xx, yy], i) => (i ? 'L' : 'M') + xx.toFixed(2) + ',' + yy.toFixed(2))
    .join(' ');
  const area = `${path} L ${x(years)},${y(0)} L ${x(0)},${y(0)} Z`;
  let cashdots = values
    .filter(
      d =>
        d.year === 0 ||
        d.year === years ||
        d.year === 1 ||
        d.year === 5 ||
        d.year === 10 ||
        d.year === 25
    )
    .map(
      d =>
        `<circle class="cashmark" data-year="${d.year}" cx="${x(d.year)}" cy="${y(d.cumulative / 1e6)}" r="5" fill="#8fe2c7" stroke="#0f2830" stroke-width="2"><title>Year ${d.year}: ${fmtMoney(d.cumulative)}</title></circle>`
    )
    .join('');
  let pay = '';
  if (model.payback !== null && model.payback <= years) {
    pay = `<line class="payback-line" x1="${x(model.payback)}" x2="${x(model.payback)}" y1="${T}" y2="${H - B}"/><circle class="payback-dot" cx="${x(model.payback)}" cy="${y(0)}" r="6"/><text class="chart-tooltip" x="${Math.min(x(model.payback) + 11, W - 155)}" y="${Math.max(T + 15, y(0) - 13)}">PAYBACK ${nf(model.payback, 2)}Y</text>`;
  }
  svg.innerHTML = `<defs><linearGradient id="cash-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#66e6ba" stop-opacity=".32"/><stop offset="1" stop-color="#4cd1ad" stop-opacity=".025"/></linearGradient></defs>${grid}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="zero-line"/><path class="area" d="${area}"/><path class="cash-path" d="${path}"/>${pay}${cashdots}${svgText(W - R, H - 18, 'YEAR', 'text-anchor="end"')}`;
  const ann = $('#cashflow-annotation');
  ann.textContent =
    model.payback !== null
      ? 'Payback ' + nf(model.payback, 2) + ' years'
      : 'Payback not reached in model horizon';
  // Optional chart draw-in effect; only when path length is small enough and motion allowed.
  const line = svg.querySelector('.cash-path');
  if (!reducedMotion && line && line.getTotalLength()) {
    const len = line.getTotalLength();
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    line.getBoundingClientRect();
    line.style.transition = 'stroke-dashoffset 650ms cubic-bezier(.2,.8,.2,1)';
    line.style.strokeDashoffset = '0';
  }
}
function drawDieselChart() {
  const svg = $('#chart-diesel');
  const W = 560,
    H = 300,
    L = 63,
    R = 16,
    T = 20,
    B = 45,
    yrs = 25;
  const paths = [
    { k: 0.1, type: 'low' },
    { k: 0.2, type: 'mid' },
    { k: 0.3, type: 'high' },
  ];
  const all = paths.flatMap(p =>
    Array.from({ length: yrs }, (_, i) => state.price * Math.pow(1 + p.k, i))
  );
  const lo = Math.log(Math.max(1, Math.min(...all)) * 0.8),
    hi = Math.log(Math.max(...all) * 1.3);
  const x = year => L + ((year - 1) / (yrs - 1)) * (W - L - R),
    y = v => T + ((hi - Math.log(v)) / (hi - lo)) * (H - T - B);
  let grid = '';
  for (let j = 0; j < 5; j++) {
    const value = Math.exp(lo + ((hi - lo) * j) / 4);
    grid += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${y(value)}" y2="${y(value)}"/>${svgText(L - 11, y(value) + 4, number(value, 0), 'text-anchor="end"')}`;
  }
  for (const yr of [1, 5, 10, 15, 20, 25])
    grid += svgText(x(yr), H - 18, yr, 'text-anchor="middle"');
  let lines = '';
  for (const p of paths) {
    const pts = Array.from(
      { length: yrs },
      (_, i) =>
        ` ${i ? 'L' : 'M'}${x(i + 1).toFixed(2)},${y(state.price * Math.pow(1 + p.k, i)).toFixed(2)}`
    ).join('');
    lines += `<path class="diesel-line ${p.type} ${state.escalation === p.k ? 'is-selected' : ''}" d="${pts}"/>`;
    const v = state.price * Math.pow(1 + p.k, 24);
    lines += `<circle cx="${x(25)}" cy="${y(v)}" r="${state.escalation === p.k ? 5 : 3.2}" fill="${p.k === 0.1 ? '#78aae7' : p.k === 0.2 ? '#6bdfb1' : '#e8ae70'}"><title>${nf(p.k * 100)}% scenario: ${nf(v, 2)} EGP/L at Year 25</title></circle>`;
  }
  svg.innerHTML =
    grid + lines + svgText(W - R, H - 18, 'YEAR', 'text-anchor="end"');
}
function selectAsset(id, zoom = false) {
  $$('[data-asset]').forEach(b =>
    b.classList.toggle('selected', b.dataset.asset === id)
  );
  const supplier = state.design === 'supplier';
  const info = {
    pv: [
      'Solar PV field',
      supplier
        ? '456 kWp • 702 × 650 Wp Jinko modules'
        : '304 kWp • 468 × 650 Wp illustrative modules',
      'Ground-mounted bifacial PV array. Energy generation depends on solar irradiation, shading, losses and curtailment; conceptual geometry is not a construction layout.',
    ],
    bess: [
      'Battery energy storage',
      supplier
        ? '3 × 161.3 kWh Huawei units (~483.9 kWh)'
        : '3 × 107 kWh model units (321 kWh)',
      'Battery-assisted genset-off operation requires approved grid-forming controls, SOC limits and commissioning of switching/interlocking.',
    ],
    genset: [
      'Existing diesel generator',
      'CAT 3406C • baseline 740 litres/day',
      'Existing generator runs outside the designated illustrative shutdown window. Actual switchover time, ratings and transition sequence require site validation.',
    ],
    esp: [
      'Electric submersible pump',
      '165 kVA nominal load • 210 kVA start-up',
      '24-hour critical load supplied through the VSD. The energy-source transition is designed to maintain uninterrupted pumping, subject to detailed integration studies.',
    ],
  }[id];
  if (!info) return;
  txt('asset-title', info[0]);
  txt('asset-subtitle', info[1]);
  txt('asset-description', info[2]);
  if (zoom && state.scene) state.scene.focusAsset(id);
  document.dispatchEvent(new CustomEvent('wepco:asset-selected', {
    detail: { id, title: info[0], subtitle: info[1], description: info[2] }
  }));
}
function updateTime() {
  const t = Math.floor(Math.max(0, Math.min(23, Number(state.hour) || 0)));
  state.hour = t;
  txt('current-time', String(t).padStart(2, '0') + ':00');
  $('#hour-range').value = String(t);
  const row = state.tech?.rows[getIndex(state.month, state.day, t)];
  if (!row) {
    txt('time-period', 'MODEL LOADING');
    return;
  }
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2025, state.month - 1, state.day)));
  txt('deck-clock', String(t).padStart(2, '0') + ':00');
  $('#cycle-progress').style.width = (((t + 1) / 24) * 100).toFixed(1) + '%';
  const selectedRows = state.tech.rows.slice(
    getIndex(state.month, state.day, 0),
    getIndex(state.month, state.day, 0) + 24
  );
  const selectedOffHours = selectedRows.reduce(
    (total, h) => total + (h.dieselOn ? 0 : 1),
    0
  );
  txt('selected-day-off', nf(selectedOffHours));
  txt(
    'selected-day-detail',
    `${dateLabel} · ${nf(24 - selectedOffHours)} h DG running`
  );

  txt(
    'time-period',
    row.ghi > 5 ? 'SOLAR WEATHER / ' + dateLabel : 'NIGHT / ' + dateLabel
  );
  txt(
    'pv-state',
    row.pvAvailable > 0.5
      ? row.pvUsed > 0.5
        ? 'ACTIVE'
        : 'CURTAILED'
      : 'NO IRRADIANCE'
  );
  txt('bess-state', row.batteryState);
  txt('diesel-state', row.dieselOn ? 'ON' : 'OFF');
  $('#diesel-state').style.color = row.dieselOn ? '#edc38f' : '#72eabd';
  txt('kwh-pv', nf(row.pvAvailable, 1));
  txt('kwh-solar', nf(row.solarToLoad, 1));
  txt('kwh-batt', nf(row.batteryToLoad, 1));
  txt('kwh-charge', nf(row.charge, 1));
  txt('kwh-diesel', nf(row.genToLoad, 1));
  txt('kwh-curtail', nf(row.curtailed, 1));
  txt('kwh-load', nf(row.loadKw, 1));
  txt('kwh-ghi', nf(row.ghi, 0));
  txt('kwh-temp', nf(row.temperature, 1));
  txt('flow-pv-kw', nf(row.solarToLoad + row.charge, 1));
  txt('flow-inverter-kw', nf(row.solarToLoad + row.charge, 1));
  txt('flow-battery-kw', nf(row.batteryToLoad || row.charge, 1));
  txt(
    'flow-battery-label',
    row.batteryToLoad > 0.05
      ? 'BESS → LOAD'
      : row.charge > 0.05
        ? 'PV → BESS'
        : 'BESS IDLE'
  );
  txt('flow-diesel-kw', nf(row.genToLoad, 1));
  txt('flow-esp-kw', nf(row.loadKw, 1));
  $('.flow-readout.battery').classList.toggle(
    'discharging',
    row.batteryToLoad > 0.05
  );
  $('.flow-readout.battery').classList.toggle('charging', row.charge > 0.05);
  for (const [k, active] of [
    ['solar', row.solarToLoad + row.charge > 0.05],
    ['inverter', row.solarToLoad + row.charge > 0.05],
    ['battery', row.charge + row.batteryToLoad > 0.05],
    ['diesel', row.genToLoad > 0.05],
  ])
    $('.flow-readout.' + k).classList.toggle('energized', active);

  txt('kwh-soc', nf(row.soc * 100, 1));
  txt('kwh-stored', nf(row.socKwh, 1));
  $('#soc-fill').style.width = (row.soc * 100).toFixed(1) + '%';
  txt(
    'power-status',
    row.dieselOn
      ? 'DIESEL GENERATOR • ISLAND SUPPLY'
      : 'DIESEL OFF • SOLAR / BATTERY ISLAND'
  );
  txt(
    'balance-status',
    'AC load ' +
      nf(row.loadKw, 1) +
      ' kW = PV ' +
      nf(row.solarToLoad, 1) +
      ' + BESS ' +
      nf(row.batteryToLoad, 1) +
      ' + DG ' +
      nf(row.genToLoad, 1)
  );
  if (state.scene) {
    state.scene.setTime(t);
    state.scene.setDispatch(row);
  }
  const svg = $('#day-power-bars');
  if (svg) {
    const start = getIndex(state.month, state.day, 0),
      day = state.tech.rows.slice(start, start + 24);
    const max =
      Math.max(
        1,
        ...day.map(x => x.pvAvailable),
        state.loadKva * state.powerFactor
      ) * 1.07;
    let out =
      '<line x1="16" y1="131" x2="706" y2="131" stroke="rgba(205,238,235,.25)"/>';
    day.forEach((x, i) => {
      const xx = 20 + i * 28.3,
        y = 131;
      const hs = (x.solarToLoad / max) * 106,
        hb = (x.batteryToLoad / max) * 106,
        hg = (x.genToLoad / max) * 106;
      out += `<rect x="${xx}" y="${y - hg}" width="17" height="${hg}" rx="1" fill="#e8b367"/><rect x="${xx}" y="${y - hg - hs}" width="17" height="${hs}" rx="1" fill="#6fd8c6"/><rect x="${xx}" y="${y - hg - hs - hb}" width="17" height="${hb}" rx="1" fill="#779ee1"/>`;
      if (i % 4 === 0)
        out += `<text x="${xx + 7}" y="150" fill="#93b8b8" font-size="10" text-anchor="middle">${String(i).padStart(2, '0')}</text>`;
      if (i === t)
        out += `<rect x="${xx - 4}" y="8" width="24" height="132" fill="none" stroke="#fff" stroke-width="1.3" rx="3"/>`;
    });
    svg.innerHTML = out;
  }
}
function updateDispatch() {
  // The 3D plant follows the same V11 source-dispatch physics as the
  // executive KPIs. Its mesh layout remains a conceptual reference.
  state.tech = simulateForScene(
    window.WEPCO_V13_CUSTOM_DESIGN ? 'custom' : state.design,
    state.loadKva,
    state.powerFactor,
    window.WEPCO_V13_CUSTOM_DESIGN || null
  );
  txt('tech-off-hours', nf(state.tech.annual.offHours));
  txt('model-avg-off', nf(state.tech.annual.offHours / 365, 2));
  txt(
    'model-avg-detail',
    `${nf(state.tech.annual.offHours)} h off / 8,760 modeled h`
  );

  txt('tech-fuel', nf(state.tech.annual.dieselAvoidedL));
  txt('tech-pv-energy', nf(state.tech.annual.pvKwh / 1000, 1));
  txt('tech-curtail', nf(state.tech.annual.curtailKwh / 1000, 1));
  txt('tech-load-kva', nf(state.loadKva));
  txt('tech-load-kw', nf(state.loadKva * state.powerFactor, 1));
  txt('tech-pf', nf(state.powerFactor, 2));
  txt('tech-bess-kwh', nf(state.tech.config.bessKwh, 1));
  txt(
    'tech-design',
    state.design === 'supplier'
      ? '456 kWp supplier proposal'
      : '304 kWp financial reference'
  );
  const warning = state.tech.annual.offHours / 365;
  if (state.design === 'supplier') {
    $('#apply-technical-finance').disabled = true;
    $('#apply-technical-finance').textContent =
      'Supplier EPC economics not established • sensitivity disabled';
  } else {
    $('#apply-technical-finance').disabled = false;
    $('#apply-technical-finance').textContent =
      '↗ Apply modelled off-hours to economic sensitivity (304 kWp only)';
  }
  txt(
    'tech-gap',
    `Modeled DG-off: ${nf(warning, 2)} h/day · Financial reference: ${nf(BASE.gensetOffHours, 2)} h/day.`
  );
  updateTime();
}

function switchDesign() {
  state.design = $('#design-basis').value;
  if (state.design === 'supplier') {
    txt('spec-pv', '456 kWp');
    txt('spec-bess', '483.9 kWh');
    txt('spec-inv', '3 × 150 kW');
    txt(
      'design-warning',
      'Supplier 456 kWp / 483.9 kWh physical scheme only. All economics remain those of the separate 304 kWp feasibility model — not recalculated for the supplier scope.'
    );
  } else {
    txt('spec-pv', '304 kWp');
    txt('spec-bess', '321 kWh');
    txt('spec-inv', '2 × 150 kW');
    txt(
      'design-warning',
      'Financial results correspond to the 304 kWp feasibility inputs. 3D visualization is indicative.'
    );
  }
  if (state.scene) state.scene.setMode(state.design);
  selectAsset('pv', false);
  updateDispatch();
}
function bind() {
  initHoursGrid();
  for (const [control, key, transform] of [
    ['ctrl-diesel', 'price', Number],
    ['ctrl-offtime', 'offtime', Number],
    ['ctrl-fx', 'fx', Number],
    ['ctrl-discount', 'discount', v => Number(v) / 100],
  ]) {
    $('#' + control).addEventListener('input', e => {
      state[key] = transform(e.target.value);
      updateModel();
    });
  }
  $$('[data-escalation]').forEach(btn =>
    btn.addEventListener('click', () => {
      state.escalation = Number(btn.dataset.escalation);
      updateModel();
    })
  );
  $('#reset-model').addEventListener('click', () => {
    state.price = BASE.dieselPrice;
    state.escalation = BASE.escalation;
    state.offtime = BASE.gensetOffHours;
    $('#ctrl-offtime').max = '12';
    state.fx = BASE.fx;
    state.discount = BASE.discount;
    for (const [id, value] of [
      ['ctrl-diesel', state.price],
      ['ctrl-offtime', state.offtime],
      ['ctrl-fx', state.fx],
      ['ctrl-discount', state.discount * 100],
    ])
      $('#' + id).value = String(value);
    updateModel();
  });
  $('#chart-ten').addEventListener('click', () => {
    state.range = 10;
    $('#chart-ten').classList.add('active');
    $('#chart-twentyfive').classList.remove('active');
    drawCashChart();
  });
  $('#chart-twentyfive').addEventListener('click', () => {
    state.range = 25;
    $('#chart-twentyfive').classList.add('active');
    $('#chart-ten').classList.remove('active');
    drawCashChart();
  });
  $('#hour-range').addEventListener('input', e => {
    state.hour = Math.min(23, Math.round(Number(e.target.value)));
    updateTime();
  });
  $('#ctrl-load').addEventListener('input', e => {
    state.loadKva = Number(e.target.value);
    const v11 = document.getElementById('v11-load');
    if (v11) {
      v11.value = String(state.loadKva);
      v11.dispatchEvent(new Event('input', { bubbles:true }));
    }
    updateDispatch();
  });
  $('#ctrl-pf').addEventListener('input', e => {
    state.powerFactor = Number(e.target.value);
    const v11 = document.getElementById('v11-pf');
    if (v11) {
      v11.value = String(state.powerFactor);
      v11.dispatchEvent(new Event('input', { bubbles:true }));
    }
    updateDispatch();
  });
  $('#ctrl-month').addEventListener('change', e => {
    state.month = Number(e.target.value);
    const maxDays = new Date(Date.UTC(2025, state.month, 0)).getUTCDate();
    state.day = Math.min(state.day, maxDays);
    $('#ctrl-day').max = String(maxDays);
    $('#ctrl-day').value = String(state.day);
    updateTime();
  });
  $('#ctrl-day').addEventListener('input', e => {
    state.day = Math.max(
      1,
      Math.min(
        new Date(Date.UTC(2025, state.month, 0)).getUTCDate(),
        Math.round(Number(e.target.value) || 1)
      )
    );
    e.target.value = String(state.day);
    updateTime();
  });
  $('#apply-technical-finance').addEventListener('click', () => {
    if (state.design !== 'feasibility') return;
    const avg = state.tech.annual.offHours / 365;
    state.offtime = avg;
    $('#ctrl-offtime').max = String(Math.max(12, avg + 1));
    $('#ctrl-offtime').value = String(avg);
    updateModel();
    txt(
      'tech-gap',
      `Scenario sensitivity: ${nf(avg, 2)} h/day DG-off applied · Original financial reference: ${nf(BASE.gensetOffHours, 2)} h/day.`
    );
  });
  $('#reset-technical').addEventListener('click', () => {
    state.loadKva = 165;
    state.powerFactor = 0.9;
    state.month = 6;
    state.day = 15;
    state.hour = 12;
    $('#ctrl-load').value = '165';
    $('#ctrl-pf').value = '.9';
    $('#ctrl-month').value = '6';
    $('#ctrl-day').value = '15';
    $('#ctrl-day').max = '30';
    updateDispatch();
  });
  $('#design-basis').addEventListener('change', switchDesign);
  $$('[data-asset]').forEach(b =>
    b.addEventListener('click', () => selectAsset(b.dataset.asset, true))
  );
  $('#view-flow').addEventListener('click', () => {
    state.flowVisible = !state.flowVisible;
    const btn = $('#view-flow');
    btn.classList.toggle('active', state.flowVisible);
    btn.setAttribute('aria-pressed', String(state.flowVisible));
    btn.textContent = state.flowVisible ? 'FLOW ON' : 'FLOW OFF';
    state.scene?.setFlowVisible(state.flowVisible);
  });
  const tourButton = $('#camera-tour');
  const displayTour = active => {
    tourButton.setAttribute('aria-pressed', String(Boolean(active)));
    tourButton.classList.toggle('active', Boolean(active));
    tourButton.textContent = active ? '■ STOP TOUR' : '▶ CINEMATIC TOUR';
  };
  if (reducedMotion) {
    tourButton.disabled = true;
    tourButton.title =
      'Automatic camera movement disabled by reduced-motion settings.';
  }
  tourButton.addEventListener('click', () => {
    if (!state.scene) return;
    if (state.scene.tourActive) state.scene.stopTour();
    else {
      $$('[data-camera-view]').forEach(b =>
        b.setAttribute('aria-pressed', 'false')
      );
      state.scene.startTour();
    }
  });
  $$('[data-camera-view]').forEach(button =>
    button.addEventListener('click', () => {
      if (!state.scene) return;
      state.scene.setCameraView(button.dataset.cameraView);
      $$('[data-camera-view]').forEach(b =>
        b.setAttribute('aria-pressed', String(b === button))
      );
    })
  );
  $('#view-reset').addEventListener('click', () => {
    state.scene?.resetCamera();
    $$('[data-camera-view]').forEach(b =>
      b.setAttribute(
        'aria-pressed',
        String(b.dataset.cameraView === 'overview')
      )
    );
  });
  $('#view-pause').addEventListener('click', () => {
    state.paused3D = !state.paused3D;
    state.scene?.setPaused(state.paused3D);
    txt('view-pause', state.paused3D ? '▶' : 'Ⅱ');
  });
  $('#time-play').addEventListener('click', () => {
    state.playing = !state.playing;
    txt(
      'play-text',
      state.playing ? 'PAUSE 24-HOUR CYCLE' : 'PLAY 24-HOUR CYCLE'
    );
    txt('play-icon', state.playing ? 'Ⅱ' : '▶');
    $('#time-play').setAttribute('aria-pressed', String(state.playing));
  });
  let last = 0;
  const tick = now => {
    if (state.playing && !document.hidden) {
      const delta = last ? Math.min(0.085, (now - last) / 1000) : 0;
      state.playElapsed = (state.playElapsed || 0) + delta * 0.7;
      if (state.playElapsed >= 1) {
        state.hour = (state.hour + 1) % 24;
        state.playElapsed = 0;
        updateTime();
      }
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('wepco:v11-updated', event => {
    // Keep 3D load, PV/BESS capacities, source-flow and engineering metrics
    // in sync with the one visible V13 scenario/physics engine.
    const newLoad = event.detail?.inputs?.loadKva;
    const newPf = event.detail?.inputs?.pf;
    if (Number.isFinite(newLoad)) state.loadKva = newLoad;
    if (Number.isFinite(newPf)) state.powerFactor = newPf;
    if (event.detail?.caseId === 'custom') {
      window.WEPCO_V13_CUSTOM_DESIGN = event.detail.design;
    } else {
      window.WEPCO_V13_CUSTOM_DESIGN = null;
    }
    $('#ctrl-load').value = String(state.loadKva);
    $('#ctrl-pf').value = String(state.powerFactor);
    updateDispatch();
  });
  updateModel();
  updateTime();
  switchDesign();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (
            !entry.isIntersecting &&
            state.playing &&
            entry.target.id === 'experience'
          ) {
            state.playing = false;
            txt('play-text', 'PLAY 24-HOUR CYCLE');
            txt('play-icon', '▶');
            $('#time-play').setAttribute('aria-pressed', 'false');
          }
        });
      },
      { threshold: 0.05 }
    );
    observer.observe($('#experience'));
  }
  // Scene loading is independent: finance, controls and charts remain functional offline.
  import('./scene.js')
    .then(({ MicrogridScene }) => {
      try {
        state.scene = new MicrogridScene($('#three-canvas'), {
          onAssetClick: id => selectAsset(id, false),
          onTourChange: active => displayTour(active),
        });
        $('#scene-fallback').remove();
        state.scene.setTime(state.hour);
        state.scene.setMode(state.design);
        state.scene.setFlowVisible(state.flowVisible);
        if (state.tech)
          state.scene.setDispatch(
            state.tech.rows[getIndex(state.month, state.day, state.hour)]
          );
        if (reducedMotion) state.scene.setPaused(true);
        document.dispatchEvent(new CustomEvent('wepco:scene-ready'));
      } catch (err) {
        console.warn('3D renderer unavailable, static schematic shown:', err);
        txt('scene-fallback', '');
        $('#scene-fallback').innerHTML =
          '<div class="fallback-art"><div class="fallback-sun"></div><div class="fallback-panels"></div><div class="fallback-box a"></div><div class="fallback-box b"></div><div class="fallback-box c"></div></div><p>Interactive 3D requires WebGL support.</p>';
      }
    })
    .catch(err => {
      $('#scene-fallback p').textContent =
        '3D renderer requires an internet connection to load Three.js.';
      console.warn('3D module unavailable:', err);
    });
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', bind);
else bind();
