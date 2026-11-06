import '../v11-optimizer.css';
import { sanitizeScenario, simulateV11Year } from './v11-model.js';

// Non-monetary sizing Pareto frontier. NO fictitious CAPEX regression.
const $ = id => document.getElementById(id);
let all = [];
let chosen = null;
let debounce = null;
const number = (v, d=0) => Number.isFinite(v) ? v.toLocaleString('en-US', {maximumFractionDigits:d,minimumFractionDigits:d}) : '—';

function buildOptions() {
  const load = Math.max(70, Math.min(250, Number($('v11-load').value || 165)));
  const pf = Math.max(.7, Math.min(1, Number($('v11-pf').value || .9)));
  const pvSizes = [250, 304, 380, 456, 550, 650, 750, 900];
  const batterySizes = [161.3, 241, 321, 483.9, 650, 900, 1200, 1800];
  all = [];
  for(const pv of pvSizes) for(const battery of batterySizes) {
    const design = sanitizeScenario({
      id:'opt-' + pv + '-' + battery,
      name:'Sizing candidate',
      pvKwp:pv,
      bessKwh:battery,
      inverterKw:Math.ceil(pv/150)*150,
      pcsKw:Math.min(1000, Math.max(108, battery*108/161.3)),
      capexUSD:null
    });
    const simulated = simulateV11Year(design, {loadKva:load, pf}, false);
    const sizeIndex = .5 * design.pvKwp/304 + .5 * design.bessKwh/321;
    all.push({design, sizeIndex, ...simulated.annual});
  }
  // A point is technically dominated when another option is smaller AND delivers more generator-off hours.
  all.forEach(item => {
    item.frontier = !all.some(other =>
      other !== item &&
      other.sizeIndex <= item.sizeIndex + 1e-9 &&
      other.offHours >= item.offHours &&
      (other.sizeIndex < item.sizeIndex - 1e-9 || other.offHours > item.offHours)
    );
  });
  all.sort((a,b) => a.sizeIndex - b.sizeIndex);
  return all;
}
function renderChart() {
  const svg = $('v11-pareto-chart');
  if (!svg) return;
  const minIndex = Math.min(...all.map(x=>x.sizeIndex));
  const maxIndex = Math.max(...all.map(x=>x.sizeIndex));
  const maxOff = Math.max(...all.map(x=>x.offHours)) + 280;
  const W=920, H=325, L=60, T=20, R=30, B=49;
  const scaleX = x => L + (x.sizeIndex-minIndex)/(maxIndex-minIndex)*(W-L-R);
  const scaleY = x => T + (1-x.offHours/maxOff)*(H-T-B);
  const lines = [];
  for(let k=0;k<=5;k++) {
    const y=T+(H-T-B)*k/5;
    const off=maxOff*(1-k/5);
    lines.push('<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="#234a52" stroke-dasharray="3 6"/>');
    lines.push('<text x="'+(L-14)+'" y="'+(y+4)+'" text-anchor="end" fill="#90b0b7" font-size="12">'+number(off)+'</text>');
  }
  const frontier=all.filter(r=>r.frontier);
  frontier.sort((a,b)=>a.sizeIndex-b.sizeIndex);
  const polyline=frontier.map(o=>scaleX(o).toFixed(2)+','+scaleY(o).toFixed(2)).join(' ');
  lines.push('<polyline points="'+polyline+'" fill="none" stroke="#77e2bd" stroke-width="3" stroke-linejoin="round"/>');
  all.forEach((item,i) => {
    const selected = chosen && item.design.id === chosen.design.id;
    lines.push('<circle data-opt-index="'+i+'" tabindex="0" role="button" aria-label="PV '+number(item.design.pvKwp)+' and BESS '+number(item.design.bessKwh)+'" cx="'+scaleX(item)+'" cy="'+scaleY(item)+'" r="'+(selected?8:5)+'" fill="'+(item.frontier?'#80e9c1':'#6d8e9f')+'" stroke="'+(selected?'#fff':'#102e36')+'" stroke-width="2"/>');
  });
  lines.push('<text x="'+(W/2)+'" y="'+(H-10)+'" text-anchor="middle" fill="#a9ccca" font-size="13">Relative technical equipment-size index (NOT CAPEX)</text>');
  lines.push('<text x="30" y="15" fill="#a9ccca" font-size="12">DG off-hours/year ↑</text>');
  svg.innerHTML=lines.join('');
  $('v11-pareto-count').textContent=frontier.length+' technically non-dominated cases / '+all.length+' simulations';
}
function inspect(item) {
  chosen=item;
  $('v11-opt-pv').textContent=number(item.design.pvKwp)+' kWp';
  $('v11-opt-bess').textContent=number(item.design.bessKwh,1)+' kWh';
  $('v11-opt-off').textContent=number(item.offHours)+' h / yr';
  $('v11-opt-index').textContent=number(item.sizeIndex,2)+' ×';
  $('v11-opt-status').textContent=item.frontier?'PARETO FRONTIER':'TECHNICALLY DOMINATED';
  renderChart();
}
function schedule() {
  clearTimeout(debounce);
  debounce=setTimeout(() => {
    buildOptions();
    const next=chosen && all.find(item=>item.design.id===chosen.design.id);
    inspect(next || all.filter(x=>x.frontier)[Math.floor(all.filter(x=>x.frontier).length/2)] || all[0]);
  },330);
}
function init() {
  const site=$('v11');
  if (!site) return;
  const section=document.createElement('section');
  section.id='v11-optimizer';
  section.className='v11-card v11-optimizer';
  section.innerHTML = [
    '<div class="v11-card-head"><div><span>SIZE OPTIMIZATION / TECHNICAL PARETO</span><h3>How much installed equipment buys how many diesel-off hours?</h3></div><b class="v11-pill">64 FULL-YEAR SIMULATIONS</b></div>',
    '<p class="v11-opt-intro">Compare technical potential without inventing EPC quotes. Green points are non-dominated by smaller equipment on this illustrative sizing index. It is not a financial optimum or a verified operational guarantee.</p>',
    '<svg id="v11-pareto-chart" viewBox="0 0 920 325" role="img" aria-label="Pareto plot showing relative equipment size index versus generator-off annual hours"></svg>',
    '<div class="v11-opt-foot"><span id="v11-pareto-count">Computing sizing frontier…</span><span>GREEN: PARETO · GRAY: DOMINATED · TAP A POINT TO INSPECT</span></div>',
    '<div class="v11-opt-card"><div><span>SELECTED PV</span><strong id="v11-opt-pv">—</strong></div><div><span>SELECTED BESS</span><strong id="v11-opt-bess">—</strong></div><div><span>GENSET OFF</span><strong id="v11-opt-off">—</strong></div><div><span>SIZE INDEX</span><strong id="v11-opt-index">—</strong></div></div>',
    '<div class="v11-opt-actions"><span id="v11-opt-status">TECHNICAL SCREENING</span><button id="v11-apply-opt" class="v11-button">↗ APPLY TO CUSTOM DESIGN</button></div>',
    '<p class="v11-foot">Index = 0.5 × (PV kWp ÷ 304) + 0.5 × (BESS kWh ÷ 321); purely dimensionless. Fixed load, PF, source weather and simplified PCS sizing; no land, replacement or supplier CAPEX. Any real dollar/kWh Pareto frontier requires priced supplier alternatives and firm technology constraints.</p>'
  ].join('\n');
  const sld=site.querySelector('.v11-electrical');
  if(sld) sld.before(section);else site.appendChild(section);
  $('v11-pareto-chart').addEventListener('click', event => {
    const match=event.target.closest('[data-opt-index]');
    if(match) inspect(all[Number(match.dataset.optIndex)]);
  });
  $('v11-pareto-chart').addEventListener('keydown', event => {
    if(event.key==='Enter'||event.key===' ') {
      const match=event.target.closest('[data-opt-index]');
      if(match) { event.preventDefault(); inspect(all[Number(match.dataset.optIndex)]); }
    }
  });
  $('v11-apply-opt').addEventListener('click', () => {
    if(!chosen)return;
    const d=chosen.design;
    $('v11-case').value='custom';
    $('v11-case').dispatchEvent(new Event('change', {bubbles:true}));
    const inputs=[['v11-pv',d.pvKwp],['v11-bess',d.bessKwh],['v11-inverters',d.inverterKw],['v11-pcs',d.pcsKw]];
    for(const [id,value] of inputs) $(''+id).value=String(value);
    $('v11-pv').dispatchEvent(new Event('input',{bubbles:true}));
    $('v11-optimizer').scrollIntoView({behavior:'smooth',block:'start'});
  });
  for (const id of ['v11-load','v11-pf']) {
    $(id).addEventListener('change',schedule);
  }
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
