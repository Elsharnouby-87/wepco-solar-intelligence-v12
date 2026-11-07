import { getIndex } from './dispatch.js';
// Compact real-time view powered exclusively by the V11 hourly result event.
const $ = id => document.getElementById(id);
let year = null;
let selectedMonth = 6;
let selectedDay = 15;

function insert() {
  const cycle = document.querySelector('#experience .cycle-deck');
  if (!cycle) return;
  const timeline = document.createElement('div');
  timeline.className = 'v13-simple-time';
  timeline.innerHTML = '<span>MODEL HOUR</span><small>00:00</small><div id="v13-timeline-slot"></div><small>23:00</small>';
  cycle.querySelector('.cycle-lead')?.after(timeline);
  const slider = $('hour-range');
  const slot = $('v13-timeline-slot');
  if (slider && slot) {
    slider.removeAttribute('class');
    slot.appendChild(slider);
    slider.setAttribute('aria-label', 'Model time of day from midnight to 23:00');
  }
  const graphic = document.createElement('div');
  graphic.className = 'v13-flow-assembly';
  graphic.innerHTML = [
    '<div class="v13-simple-flow" aria-label="Modeled current power balance">',
      '<div class="v13-flow-source"><span>☀ PV</span><strong id="v13-kw-pv">—</strong></div>',
      '<div class="v13-flow-source"><span>▣ BESS</span><strong id="v13-kw-bess">—</strong></div>',
      '<div class="v13-flow-source" aria-label="Diesel"><span>◉ DIESEL</span><strong id="v13-kw-dg">—</strong></div>',
      '<div class="v13-flow-connector">→</div>',
      '<div class="v13-flow-source v13-flow-load"><span>⬡ ESP LOAD</span><strong id="v13-kw-esp">—</strong></div>',
    '</div>',
    '<div class="v13-flow-meta"><span id="v13-flow-hour">12:00 · 24-hour source dispatch</span>',
      '<span id="v13-flow-status">BESS reserve and generator status calculated hourly</span>',
      '<span id="v13-flow-soc">BATTERY SOC —</span></div>'
  ].join('\n');
  timeline.after(graphic);
}

function refresh() {
  if (!year || !year.rows?.length) return;
  const month = Math.max(1, Math.min(12, Number($('ctrl-month')?.value || selectedMonth)));
  const day = Math.max(1, Math.min(31, Number($('ctrl-day')?.value || selectedDay)));
  const hour = Math.max(0, Math.min(23, Number($('hour-range')?.value || 12)));
  const row = year.rows[getIndex(month, day, hour)];
  if (!row) return;
  const result = [['v13-kw-pv',row.solarToLoad],['v13-kw-bess',row.batteryToLoad],['v13-kw-dg',row.genToLoad],['v13-kw-esp',row.loadKw]];
  for (const [id,amount] of result) if ($(id)) $(id).textContent = amount.toFixed(1) + ' kW';
  if ($('v13-flow-hour')) $('v13-flow-hour').textContent = String(hour).padStart(2, '0') + ':00 · ' + month + '/' + day + ' TMY';
  if ($('v13-flow-status')) $('v13-flow-status').textContent = row.dieselOn ? 'GENSET ON · diesel island' : 'GENSET OFF · PV/BESS island';
  if ($('v13-flow-soc')) $('v13-flow-soc').textContent = 'BATTERY SOC ' + (row.soc * 100).toFixed(1) + '%';
}
function start() {
  insert();
  document.addEventListener('wepco:v11-updated', event => {
    year = event.detail;
    refresh();
  });
  for(const id of ['hour-range','ctrl-day','ctrl-month']) {
    $(id)?.addEventListener('change',refresh);
    $(id)?.addEventListener('input',refresh);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start);
else start();
