import './v13.css';
import { estimatedDieselLitresPerHour, V11_ASSUMPTIONS } from './v11-model.js';

/**
 * V13: Progressive-disclosure executive experience.
 * Keeps V11 computation, source engineering and V10 3D in place.
 * No duplicate investment computations: the main KPI strip reflects
 * the single published V11 screening model and its active scenario.
 */
const $ = (id) => document.getElementById(id);
const fmt = (value, digits = 0) =>
  Number.isFinite(value) ? Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  }) : '—';
const compactMoney = (value) => value === null || value === undefined || !Number.isFinite(value)
  ? 'Quote required'
  : 'EGP ' + fmt(value / 1000000, 2) + 'M';
const safeText = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));

const app = {
  tab: 'explore',
  mode: 'simple',
  chart: 'energy',
  investmentChart: 'cash',
  scenario: 'feasibility',
  outcome: null,
  introPlayed: false,
  tourTimer: null,
  equipmentOpen: false,
  lastAsset: null
};

const layout = [
  '<section class="v13-overview" aria-label="Project executive overview">',
    '<div class="v13-overview-top"><div>',
      '<div class="v13-eyebrow"><span class="v13-dot"></span> WEPCO · BED 1-17 / ENGINEERING INTELLIGENCE</div>',
      '<h1>Smarter energy.<br><em>Stronger economics.</em></h1>',
      '<p>Explore how solar generation, battery storage and the existing generator can power a critical ESP well — in one clear, interactive experience.</p>',
      '<div class="v13-hero-actions"><button type="button" id="v13-tour" class="v13-primary">▶ &nbsp; Explore the 3D plant</button>',
      '<button type="button" id="v13-show-method" class="v13-secondary">What do these figures mean? ↗</button></div>',
    '</div><div class="v13-hero-side">',
      '<span class="v13-source-pill"><span></span> REPRESENTATIVE YEAR · PVGIS TMY</span>',
      '<div class="v13-side-number"><small>ESP NOMINAL ELECTRICAL LOAD</small><strong id="v13-load">148.5 <i>kW</i></strong></div>',
      '<p>Preliminary screening, not live monitoring or a guaranteed production forecast.</p>',
    '</div></div>',
    '<div class="v13-overview-metrics" id="v13-overview-metrics">',
      '<article><span>01 / DG OFF</span><strong id="v13-metric-off">—</strong><small>hours/day, simulated annual average</small></article>',
      '<article><span>02 / DIESEL AVOIDED</span><strong id="v13-metric-fuel">—</strong><small>litres/year · proxy estimate</small></article>',
      '<article><span>03 / CO₂ AVOIDED</span><strong id="v13-metric-co2">—</strong><small>tonnes/year · unverified</small></article>',
      '<article class="v13-fin-kpi"><span>04 / PROJECT NPV</span><strong id="v13-metric-npv">—</strong><small id="v13-npv-note">25-year EPC scenario</small></article>',
    '</div>',
    '<p class="v13-executive-foot"><b>Calculated, not measured.</b> Results belong to the selected design. The older 5.5h/day reference is a separate feasibility assumption, not the simulated operating result.</p>',
  '</section>',
  '<div class="v13-flow-nav" aria-label="Active investment scenario">',
    '<div class="v13-flow-name"><small>ACTIVE DESIGN</small><strong id="v13-design-label">EPROM feasibility</strong></div>',
    '<div class="v13-select-wrap"><label for="v13-scenario">DESIGN SCENARIO</label>',
      '<select id="v13-scenario"><option value="feasibility">304 kWp + 321 kWh · Feasibility</option><option value="supplier">456 kWp + 483.9 kWh · Supplier</option><option value="custom">Custom sizing · Engineering</option></select>',
    '</div>',
    '<div class="v13-view-quick"><span class="v13-mode-label">VIEW MODE</span>',
      '<button type="button" id="v13-simple" aria-pressed="true">Essential</button>',
      '<button type="button" id="v13-advanced" aria-pressed="false">Advanced</button></div>',
  '</div>',
  '<div class="v13-tab-intro" id="v13-tab-intro"><span id="v13-tab-number">01 / 03</span>',
    '<div><h2 id="v13-tab-heading">Explore the microgrid.</h2><p id="v13-tab-description">One system. Three power sources. Select equipment to understand the role of each component.</p></div>',
    '<div class="v13-tab-badge" id="v13-tab-badge">INTERACTIVE 3D EXPERIENCE</div>',
  '</div>',
  '<div class="v13-studio-toolbar" id="v13-studio-toolbar" hidden>',
    '<div class="v13-studio-tabs" role="tablist" aria-label="Engineering workspace">',
      '<button role="tab" type="button" data-v13-go="explore" aria-selected="true">Explore</button>',
      '<button role="tab" type="button" data-v13-go="performance" aria-selected="false">Performance</button>',
      '<button role="tab" type="button" data-v13-go="investment" aria-selected="false">Investment</button>',
    '</div>',
  '</div>',
  '<div class="v13-source-explainer" id="v13-source-explainer" hidden>',
    '<div><b>HOW THE MODEL WORKS</b><button aria-label="Close methodology" type="button" id="v13-close-explainer">✕</button></div>',
    '<p>Technical performance uses a representative PVGIS-derived hourly weather sequence for an entire year, PV / BESS / diesel constraints and a provisional part-load fuel curve. Financial output uses this same selected technical scenario, plus a separate scenario-specific EPC cost. It is not a vendor guarantee, engineering certification, field test or registered carbon-credit statement.</p>',
  '</div>',
  '<div class="v13-global-brief" role="status" id="v13-global-brief">Selected configuration: 304 kWp + 321 kWh. Source flows are simulated; 3D is a conceptual layout.</div>'
].join('\n');

const equipmentBar = [
  '<div class="v13-viewer-controls" role="group" aria-label="Simple 3D model controls">',
    '<button type="button" id="v13-cinematic" title="Start or stop the camera fly-through">▶ <span>Explore</span></button>',
    '<button type="button" id="v13-day-night" title="Switch simulated daylight and nighttime">☀ <span>Day / Night</span></button>',
    '<button type="button" id="v13-equipment" aria-expanded="false" aria-controls="v13-equipment-menu">⌁ <span>Equipment</span></button>',
  '</div>',
  '<div id="v13-equipment-menu" class="v13-equipment-menu" hidden>',
    '<button type="button" data-v13-asset="pv">☀ PV FIELD</button>',
    '<button type="button" data-v13-asset="bess">▣ BATTERY</button>',
    '<button type="button" data-v13-asset="genset">◉ GENERATOR</button>',
    '<button type="button" data-v13-asset="esp">⬡ ESP WELL</button>',
  '</div>',
  '<div id="v13-asset-card" class="v13-asset-card" hidden>',
    '<div class="v13-asset-card-header"><span>SELECTED EQUIPMENT</span><button type="button" id="v13-asset-close" aria-label="Close equipment card">✕</button></div>',
    '<h3 id="v13-asset-title"></h3>',
    '<strong id="v13-asset-subtitle"></strong>',
    '<p id="v13-asset-text" hidden></p>',
    '<button type="button" id="v13-asset-more">Technical details ↗</button>',
  '</div>'
].join('\n');

function scrollTab(id) {
  const tabTitle = $('v13-tab-intro');
  if (tabTitle) tabTitle.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  });
}

function setTab(tab, scroll = true) {
  if (!['explore', 'performance', 'investment'].includes(tab)) return;
  app.tab = tab;
  document.body.dataset.v13Tab = tab;
  const dictionary = {
    explore: {
      num: '01 / 03', heading: 'Explore the microgrid.',
      desc: 'One system. Three energy sources. A clear journey through the physical equipment.',
      badge: 'INTERACTIVE 3D EXPERIENCE'
    },
    performance: {
      num: '02 / 03', heading: 'See what the system delivers.',
      desc: 'The simulated source mix, generator-off hours and emissions — from one consistent design scenario.',
      badge: 'ENERGY · DIESEL · CARBON'
    },
    investment: {
      num: '03 / 03', heading: 'Understand the business case.',
      desc: 'A scenario-specific investment screen with clear price assumptions and no invented supplier economics.',
      badge: 'LIFECYCLE · 25-YEAR EPC'
    }
  };
  const detail = dictionary[tab];
  $('v13-tab-number').textContent = detail.num;
  $('v13-tab-heading').textContent = detail.heading;
  $('v13-tab-description').textContent = detail.desc;
  $('v13-tab-badge').textContent = detail.badge;
  document.querySelectorAll('[data-v13-go]').forEach(button => {
    const active = button.dataset.v13Go === tab;
    button.setAttribute('aria-selected', String(active));
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (tab === 'performance') chooseChart(app.chart);
  if (tab === 'investment') chooseInvestmentChart(app.investmentChart);
  if (scroll) scrollTab(tab);
  if (tab !== 'explore') stopTour();
  document.dispatchEvent(new Event('wepco:v13-visibility'));
}

function modeSet(mode) {
  app.mode = mode === 'advanced' ? 'advanced' : 'simple';
  document.body.dataset.v13Mode = app.mode;
  $('v13-simple').setAttribute('aria-pressed', String(app.mode === 'simple'));
  $('v13-advanced').setAttribute('aria-pressed', String(app.mode === 'advanced'));
  const tools = $('v13-advanced-tools');
  if (tools) tools.hidden = app.mode !== 'advanced';
  if (app.mode === 'advanced' && app.tab === 'performance') {
    $('v13-chart-picker')?.removeAttribute('hidden');
  }
  try { localStorage.setItem('wepco-v13-view-mode', app.mode); } catch { /* optional */ }
  document.dispatchEvent(new Event('wepco:v13-visibility'));
}

function synchronizeScenario(value) {
  app.scenario = value;
  $('v13-scenario').value = value;
  $('v11-case').value = value;
  $('v11-case').dispatchEvent(new Event('change', { bubbles:true }));
  // The 3D mesh catalog is built for 304 / 456 kWp only. Custom = illustrative.
  window.WEPCO_V13_CUSTOM_DESIGN = value === 'custom'
    ? { id:'custom', pvKwp:Number($('v11-pv').value || 600), bessKwh:Number($('v11-bess').value || 900), inverterKw:Number($('v11-inverters').value || 600), pcsKw:Number($('v11-pcs').value || 324) }
    : null;
  const visualCase = value === 'custom'
    ? Number($('v11-pv').value || 600) >= 400 ? 'supplier' : 'feasibility'
    : value;
  $('design-basis').value = visualCase;
  $('design-basis').dispatchEvent(new Event('change', { bubbles:true }));
  $('v13-design-label').textContent = value === 'feasibility'
    ? '304 kWp feasibility'
    : value === 'supplier' ? '456 kWp supplier' : 'Custom optimization';
  $('v13-global-brief').textContent = value === 'custom'
    ? 'Custom design: the 3D geometry is illustrative (nearest 304/456 kWp reference). V11 engineering simulations use the custom inputs, not the depicted module count.'
    : 'The 3D geometry represents the selected ' + (value === 'supplier' ? '456 kWp supplier' : '304 kWp feasibility') + ' scheme. Power transitions are a conceptual visualization. Numerical metrics come from the V11 hourly screening engine.';
  if (value === 'custom') { modeSet('advanced'); setTab('performance'); }
  else setTab(app.tab, false);
}

function chooseChart(chart) {
  app.chart = ['energy', 'battery', 'diesel'].includes(chart) ? chart : 'energy';
  const block = $('v11-power')?.closest('.v11-card');
  if (block) block.dataset.v13Chart = app.chart;
  document.querySelectorAll('[data-v13-chart]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.v13Chart === app.chart));
  });
}

function chooseInvestmentChart(chart) {
  app.investmentChart = chart === 'risk' ? 'risk' : 'cash';
  const financeCard = $('v11-cash')?.closest('.v11-card');
  if (financeCard) financeCard.dataset.v13Investment = app.investmentChart;
  document.querySelectorAll('[data-v13-investment-chart]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.v13InvestmentChart === app.investmentChart))
  );
  document.dispatchEvent(new Event('wepco:v13-visibility'));
}

function setViewerDay(day) {
  const slider = $('hour-range');
  if (!slider) return;
  slider.value = day ? '12' : '22';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  $('v13-day-night').innerHTML = (day ? '☀' : '☾') + ' <span>Day / Night</span>';
}
function stopTour() {
  if (app.tourTimer) { clearTimeout(app.tourTimer); app.tourTimer = null; }
  const original = $('camera-tour');
  if (original?.getAttribute('aria-pressed') === 'true') original.click();
  if ($('v13-cinematic')) $('v13-cinematic').innerHTML = '▶ <span>Explore</span>';
}
function startTour() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const original = $('camera-tour');
  if (!original || original.disabled) return;
  if (original.getAttribute('aria-pressed') === 'true') { stopTour(); return; }
  original.click();
  $('v13-cinematic').innerHTML = 'Ⅱ <span>Stop tour</span>';
  app.tourTimer = setTimeout(stopTour, 9000);
}
function showAsset(info) {
  if (!info) return;
  app.lastAsset = info;
  $('v13-asset-title').textContent = info.title;
  let rating = info.subtitle;
  if (app.scenario === 'custom' && app.outcome?.design) {
    const d = app.outcome.design;
    if (info.id === 'pv') rating = fmt(d.pvKwp) + ' kWp custom input · 3D geometry illustrative';
    if (info.id === 'bess') rating = fmt(d.bessKwh, 1) + ' kWh custom input · 3D geometry illustrative';
  }
  $('v13-asset-subtitle').textContent = rating;
  $('v13-asset-text').textContent = info.description;
  $('v13-asset-text').hidden = true;
  $('v13-asset-more').textContent = 'Technical details ↗';
  $('v13-asset-card').hidden = false;
  $('v13-equipment-menu').hidden = true;
  $('v13-equipment').setAttribute('aria-expanded', 'false');
  app.equipmentOpen = false;
  stopTour();
}

function chartAndToolbar() {
  const dispatch = $('v11-power')?.closest('.v11-card');
  if (!dispatch) return;
  const picker = document.createElement('div');
  picker.className = 'v13-chart-picker';
  picker.id = 'v13-chart-picker';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Energy visualization type');
  picker.innerHTML = '<button type="button" data-v13-chart="energy" aria-pressed="true">Energy</button><button type="button" data-v13-chart="battery" aria-pressed="false">Battery</button><button type="button" data-v13-chart="diesel" aria-pressed="false">Diesel</button>';
  dispatch.querySelector('.v11-card-head').after(picker);
  const diesel = document.createElement('div');
  diesel.id = 'v13-diesel-chart-wrap';
  diesel.className = 'v13-diesel-chart';
  diesel.innerHTML = '<p>Monthly avoided diesel, estimated using a provisional genset fuel curve.</p><svg id="v13-diesel-chart" viewBox="0 0 780 235" role="img" aria-label="Monthly avoided diesel litres chart"></svg>';
  $('v11-power').after(diesel);
  chooseChart('energy');

  const finance = $('v11-cash')?.closest('.v11-card');
  if (!finance) return;
  const menu = document.createElement('div');
  menu.className = 'v13-chart-picker';
  menu.innerHTML = '<button data-v13-investment-chart="cash" type="button" aria-pressed="true">Cash flow</button><button data-v13-investment-chart="risk" type="button" aria-pressed="false">Risk factors</button>';
  finance.querySelector('.v11-card-head').after(menu);
  chooseInvestmentChart('cash');
}

function monthlyDiesel(rows) {
  const result = new Array(12).fill(0);
  if (!Array.isArray(rows)) return result;
  const loadKw = app.outcome?.loadKw ?? 148.5;
  const perHour = estimatedDieselLitresPerHour(loadKw, app.outcome?.inputs || {});
  let previousDieselOn = true;
  for (const row of rows) {
    if (!row || row.month < 1 || row.month > 12) continue;
    if (!row.dieselOn) result[row.month - 1] += perHour;
    else if (!previousDieselOn) result[row.month - 1] -= V11_ASSUMPTIONS.startupFuelLitres;
    previousDieselOn = Boolean(row.dieselOn);
  }
  return result;
}
function drawMonthlyDiesel(rows) {
  const svg = $('v13-diesel-chart');
  if (!svg) return;
  const values = monthlyDiesel(rows);
  const scale = Math.max(1, ...values) * 1.12;
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  let output = '<line x1="32" y1="186" x2="762" y2="186" stroke="#678b90"/>';
  values.forEach((value, i) => {
    const x = 43 + i * 59;
    const h = value / scale * 151;
    output += '<rect x="' + x + '" y="' + (186 - h) + '" width="35" height="' + h + '" rx="5" fill="#76dfbb"/>';
    output += '<text x="' + (x + 17) + '" y="207" text-anchor="middle" font-size="11" fill="#9cbebd">' + months[i] + '</text>';
    output += '<title>' + fmt(value) + ' litres/month indicative</title>';
  });
  svg.innerHTML = output;
}

function syncOutcomes(detail) {
  const annual = detail?.annual;
  if (!annual) return;
  app.outcome = detail;
  $('v13-metric-off').textContent = fmt(annual.offHours / 365, 2) + ' h';
  $('v13-metric-fuel').textContent = fmt(annual.fuelSavedLitres) + ' L';
  $('v13-metric-co2').textContent = fmt(annual.co2AvoidedTonnes, 1) + ' t';
  $('v13-load').innerHTML = fmt(detail.loadKw, 1) + ' <i>kW</i>';
  const finance = $('v11-npv')?.textContent || '—';
  $('v13-metric-npv').textContent = finance;
  $('v13-npv-note').textContent = $('v11-contract')?.value === 'epc'
    ? (detail.design.capexUSD === null ? 'Missing EPC quote · no project NPV' : '25-year EPC screening · not audited')
    : 'Five-year off-taker screening';
  drawMonthlyDiesel(detail.rows);
  syncPrintableReport();
}

function generatePrintMarkup() {
  const active = app.outcome;
  if (!active) return '<p>Open the model to calculate the selected scenario.</p>';
  const annual = active.annual;
  const config = active.design;
  const inputs = active.inputs;
  const financial = $('v11-npv')?.textContent || 'Quote required';
  const irr = $('v11-irr')?.textContent || '—';
  const payback = $('v11-payback')?.textContent || '—';
  const term = $('v11-contract')?.value || 'epc';
  return [
    '<div class="v13-print-band">WEPCO · BED 1-17 <span>ENERGY INTELLIGENCE / REV 13</span></div>',
    '<h1>Solar Hybrid ESP — Executive Decision Brief</h1>',
    '<p class="v13-print-muted">Scenario-specific preliminary engineering and commercial screening. Not commissioning data or a bankable proposal.</p>',
    '<div class="v13-print-stats">',
      '<div><small>SELECTED DESIGN</small><b>' + safeText(config.name) + '</b></div>',
      '<div><small>INSTALLED PV / BESS</small><b>' + fmt(config.pvKwp) + ' kWp / ' + fmt(config.bessKwh, 1) + ' kWh</b></div>',
      '<div><small>GENSET OFF / YEAR</small><b>' + fmt(annual.offHours) + ' hours</b></div>',
      '<div><small>DIESEL AVOIDED / YEAR*</small><b>' + fmt(annual.fuelSavedLitres) + ' L</b></div>',
      '<div><small>CO₂ AVOIDED / YEAR*</small><b>' + fmt(annual.co2AvoidedTonnes, 1) + ' tonnes</b></div>',
      '<div><small>RENEWABLE SHARE</small><b>' + fmt(annual.renewableShare * 100, 1) + '%</b></div>',
      '<div><small>NPV</small><b>' + safeText(financial) + '</b></div>',
      '<div><small>IRR / PAYBACK</small><b>' + safeText(irr) + ' / ' + safeText(payback) + '</b></div>',
    '</div>',
    '<h2>Commercial assumptions</h2>',
    '<p>Contract framework: ' + safeText(term.toUpperCase()) + ' · Delivered diesel: ' + fmt(inputs.dieselPrice, 2) + ' EGP/L · FX: ' + fmt(inputs.fx, 2) + ' EGP/USD · Discount: ' + fmt(inputs.discount * 100, 1) + '% · Fuel escalation: ' + fmt(inputs.escalation * 100, 1) + '% · Quoted EPC: ' + (config.capexUSD === null ? 'NOT PROVIDED' : 'USD ' + fmt(config.capexUSD)) + '.</p>',
    '<h2>Engineering basis and limitations</h2>',
    '<p>8,760 representative hourly intervals derived from PVGIS TMY (historical climate years 2005–2023). PV/BESS/diesel dispatch uses screening assumptions including BESS SOC range, 88% round-trip efficiency, hourly islanding decisions and no genset/PV parallel operation. Inverter/PCS ratings, safety protection and start/transfer transients need engineering approval. *Diesel fuel and CO₂ reduction are estimates using a provisional, unverified engine curve and 2.697 kg CO₂/L factor. No carbon credits have been issued.</p>',
    '<p>The original 5.5 h/day feasibility workbook is a separate baseline and must not be represented as the selected 8,760-hour simulation. A missing supplier EPC quote intentionally prevents its project NPV/IRR.</p>',
    '<div class="v13-print-signature">SCREENING ONLY · SOURCE: EPROM feasibility, supplier equipment summary and PVGIS-TMY derived profiles · ' + new Date().toLocaleDateString('en-GB') + '</div>'
  ].join('\n');
}
function syncPrintableReport() {
  const report = $('v13-print-report');
  if (report) report.innerHTML = generatePrintMarkup();
}
function printReport() {
  if (!app.outcome) return;
  syncPrintableReport();
  window.print();
}

function mountLegacyBaseline() {
  const economics = $('economics');
  const impact = $('impact');
  if (!economics || !impact) return;
  const archive = document.createElement('details');
  archive.id = 'v13-original-baseline';
  archive.className = 'v13-baseline-archive';
  archive.innerHTML = '<summary>Original 5.5-hour/day workbook reference · separate, non-comparable calculation ↗</summary><p>The archived feasibility cards below use the original assumption of 5.5 h/day, fixed O&M and other separate economic assumptions. They must not be interpreted as the V11 technical scenario NPV or combined with its emissions results.</p>';
  economics.before(archive);
  archive.append(economics, impact);
}
function mountExecutiveTools() {
  const experience = $('experience');
  if (!experience) return;
  const control = document.createElement('div');
  control.innerHTML = equipmentBar;
  const viewer = experience.querySelector('.viewer');
  if (viewer) viewer.append(...Array.from(control.children));
  // Move the detailed conceptual SLD next to the 3D experience, where
  // asset selection is meaningful. Never duplicate the same drawing.
  const sld = $('v11').querySelector('.v11-electrical');
  if (sld) experience.appendChild(sld);
  const report = document.createElement('div');
  report.id = 'v13-print-report';
  report.className = 'v13-print-report';
  document.body.appendChild(report);
  const tools = document.createElement('div');
  tools.id = 'v13-advanced-tools';
  tools.hidden = true;
  tools.className = 'v13-advanced-tools';
  tools.innerHTML = '<span>ENGINEERING WORKSPACE</span><p>Detailed methodology, plant specification, simulation settings, SLD, equipment optimization and data exports remain available in Advanced mode.</p>';
  $('v11').prepend(tools);

  const finance = $('v11-cash')?.closest('.v11-card');
  if (finance) {
    const quote = document.createElement('div');
    quote.id = 'v13-quote-inline';
    quote.className = 'v13-quote-inline';
    quote.innerHTML = '<div><span>INVESTMENT INPUT</span><h3>Scenario-specific installed EPC cost</h3><p>Required for NPV / IRR. Supplier quotations are never inferred from a different PV/BESS design.</p></div><label for="v13-quote">USD per turnkey project<input id="v13-quote" type="number" min="0" step="5000" placeholder="Enter supplied EPC price"></label>';
    finance.querySelector('.v11-finance').before(quote);
    $('v13-quote').addEventListener('input', event => {
      $('v11-capex').value = event.target.value;
      $('v11-capex').dispatchEvent(new Event('input', { bubbles:true }));
    });
    const printAction = document.createElement('button');
    printAction.id = 'v13-investment-report';
    printAction.className = 'v13-primary v13-investment-report';
    printAction.type = 'button';
    printAction.textContent = '↗ Download executive brief / PDF';
    printAction.addEventListener('click', printReport);
    finance.appendChild(printAction);
  }

  const exportControls = $('v11').querySelector('.v11-report');
  if (exportControls) {
    const wrapper = document.createElement('details');
    wrapper.className = 'v13-engineering-exports';
    wrapper.innerHTML = '<summary>Technical data exports (advanced) ↗</summary>';
    exportControls.before(wrapper);
    wrapper.appendChild(exportControls);
  }
}
function bind() {
  const holder = $('top');
  if (!holder || !$('v11')) return;
  const nav = document.querySelector('.main-nav');
  if (nav) {
    nav.innerHTML = [
      '<button type="button" data-v13-go="explore" aria-current="page">01 Explore</button>',
      '<button type="button" data-v13-go="performance">02 Performance</button>',
      '<button type="button" data-v13-go="investment">03 Investment</button>',
      '<button type="button" id="v13-nav-report" class="v13-nav-report">↗ Executive report</button>'
    ].join('\n');
  }
  const container = document.createElement('div');
  container.id = 'v13-executive';
  container.className = 'v13-executive container';
  container.innerHTML = layout;
  holder.querySelector('.hero')?.after(container);
  const simpleTabs = $('v13-studio-toolbar');
  simpleTabs.hidden = true; // Top navigation is canonical; never introduce duplicate navigation.
  mountExecutiveTools();
  mountLegacyBaseline();
  chartAndToolbar();
  $('v13-advanced').addEventListener('click', () => modeSet('advanced'));
  $('v13-simple').addEventListener('click', () => modeSet('simple'));
  document.querySelectorAll('[data-v13-go]').forEach(button =>
    button.addEventListener('click', () => setTab(button.dataset.v13Go))
  );
  $('v13-scenario').addEventListener('change', event => synchronizeScenario(event.target.value));
  $('v13-tour').addEventListener('click', () => { setTab('explore'); startTour(); });
  $('v13-cinematic').addEventListener('click', startTour);
  $('v13-day-night').addEventListener('click', () => {
    const hour = Number($('hour-range').value);
    setViewerDay(hour < 7 || hour > 17);
  });
  $('v13-equipment').addEventListener('click', () => {
    app.equipmentOpen = !app.equipmentOpen;
    $('v13-equipment-menu').hidden = !app.equipmentOpen;
    $('v13-equipment').setAttribute('aria-expanded', String(app.equipmentOpen));
    if (app.equipmentOpen) stopTour();
  });
  document.querySelectorAll('[data-v13-asset]').forEach(button =>
    button.addEventListener('click', () => {
      const key = button.dataset.v13Asset;
      document.querySelector('[data-asset="' + key + '"]')?.click();
    })
  );
  $('v13-asset-more').addEventListener('click', () => {
    const details = $('v13-asset-text');
    details.hidden = !details.hidden;
    $('v13-asset-more').textContent = details.hidden ? 'Technical details ↗' : 'Less details ↑';
  });
  $('v13-asset-close').addEventListener('click', () => { $('v13-asset-card').hidden = true; });
  $('v13-show-method').addEventListener('click', () => {
    $('v13-source-explainer').hidden = !$('v13-source-explainer').hidden;
  });
  $('v13-close-explainer').addEventListener('click', () => { $('v13-source-explainer').hidden = true; });
  document.querySelectorAll('[data-v13-chart]').forEach(button =>
    button.addEventListener('click', () => chooseChart(button.dataset.v13Chart))
  );
  document.querySelectorAll('[data-v13-investment-chart]').forEach(button =>
    button.addEventListener('click', () => chooseInvestmentChart(button.dataset.v13InvestmentChart))
  );
  $('v13-nav-report').addEventListener('click', printReport);
  document.addEventListener('wepco:v11-updated', event => {
    window.WEPCO_V13_CUSTOM_DESIGN = event.detail.caseId === 'custom'
      ? event.detail.design : null;
    syncOutcomes(event.detail);
    if ($('v13-quote')) {
      $('v13-quote').value = $('v11-capex').value;
      $('v13-quote-inline').hidden = $('v11-contract').value !== 'epc';
    }
    if (event.detail.caseId !== app.scenario) {
      $('v13-scenario').value = event.detail.caseId;
      app.scenario = event.detail.caseId;
      const visual = event.detail.caseId === 'custom'
        ? event.detail.design.pvKwp >= 400 ? 'supplier' : 'feasibility'
        : event.detail.caseId;
      $('design-basis').value = visual;
      $('design-basis').dispatchEvent(new Event('change', { bubbles:true }));
      $('v13-design-label').textContent = event.detail.design.name;
    }
  });
  document.addEventListener('wepco:asset-selected', event => showAsset(event.detail));
  document.addEventListener('wepco:scene-ready', () => {
    // Gentle one-time intro only on large screens and when user hasn't interacted.
    if (app.introPlayed || window.innerWidth < 850 ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        app.tab !== 'explore') return;
    app.introPlayed = true;
    setTimeout(() => { if (app.tab === 'explore' && !app.equipmentOpen) startTour(); }, 850);
  });
  const slider = $('hour-range');
  slider?.addEventListener('pointerdown', stopTour);
  $('three-canvas')?.addEventListener('pointerdown', stopTour);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      $('v13-equipment-menu').hidden = true;
      $('v13-equipment').setAttribute('aria-expanded','false');
      app.equipmentOpen = false;
      $('v13-asset-card').hidden = true;
      stopTour();
    }
  });
  $('v13-quote-inline').hidden = false;
  modeSet('simple');
  setTab('explore', false);
  $('v13-design-label').textContent = '304 kWp feasibility';
  // V11 sends computed metrics shortly after DOMContentLoaded; no fabricated placeholders.
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
