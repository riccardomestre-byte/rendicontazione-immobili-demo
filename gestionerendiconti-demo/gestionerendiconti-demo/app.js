// Simple in-browser demo app: properties, monthly records, calculations, dashboard, and PDF

const LS_KEYS = {
  props: 'gr_demo_props',
  records: 'gr_demo_records',
  brand: 'gr_demo_brand',
  logo: 'gr_demo_logo'
};

const months = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];

// Utilities
const fmt = (n) => (new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).format(n || 0);
const parseNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const byId = (id) => document.getElementById(id);

// State
let properties = JSON.parse(localStorage.getItem(LS_KEYS.props) || '[]');
let records = JSON.parse(localStorage.getItem(LS_KEYS.records) || '[]');
let brand = JSON.parse(localStorage.getItem(LS_KEYS.brand) || '{}');
let logoDataUrl = localStorage.getItem(LS_KEYS.logo) || '';

// DOM elements
const propertyForm = byId('propertyForm');
const propertyTable = byId('propertyTable');
const recordForm = byId('recordForm');
const recordProperty = byId('recordProperty');
const recordMonth = byId('recordMonth');
const recordYear = byId('recordYear');
const airbnb = byId('airbnb');
const pulizie = byId('pulizie');
const altreSpese = byId('altreSpese');
const ownerType = byId('ownerType');
const commissionPct = byId('commissionPct');
const ownerDisplay = byId('ownerDisplay');
const propAddress = byId('propAddress');
const propCover = byId('propCover');

const c_airbnb = byId('c_airbnb');
const c_pulizie = byId('c_pulizie');
const c_altre = byId('c_altre');
const c_locazione = byId('c_locazione');
const c_comm = byId('c_comm');
const c_iva = byId('c_iva');
const c_netto = byId('c_netto');
const c_rit = byId('c_rit');
const c_bonifico = byId('c_bonifico');

const dashProperty = byId('dashProperty');
const dashYear = byId('dashYear');
const refreshDash = byId('refreshDash');
const annualTable = byId('annualTable');

const brandName = byId('brandName');
const brandColor = byId('brandColor');
const logoInput = byId('logoInput');

const downloadPDF = byId('downloadPDF');
const pdfContainer = byId('pdfContainer');
const csvInput = byId('csvInput');
const csvTemplate = byId('csvTemplate');
const notesEl = byId('notes');
const previewPDFBtn = byId('previewPDF');
const resetDataBtn = byId('resetData');
const showDiagBtn = byId('showDiag');
const debugInfo = byId('debugInfo');

let chart; // Chart.js instance

function save() {
  localStorage.setItem(LS_KEYS.props, JSON.stringify(properties));
  localStorage.setItem(LS_KEYS.records, JSON.stringify(records));
  localStorage.setItem(LS_KEYS.brand, JSON.stringify(brand));
  if (logoDataUrl) localStorage.setItem(LS_KEYS.logo, logoDataUrl);
}

// Diagnostics: show current localStorage data
if (showDiagBtn) {
  showDiagBtn.addEventListener('click', () => {
    const data = {
      properties,
      records,
      brand,
    };
    alert('Diagnostica:\n' + JSON.stringify(data, null, 2).slice(0, 1200) + (JSON.stringify(data).length>1200 ? '\n...troncato' : ''));
  });
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function renderProperties() {
  // table
  const head = `<thead><tr><th>Nome</th><th>Tipo</th><th>Commissione %</th><th></th></tr></thead>`;
  const rows = properties.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.ownerType}</td>
      <td>${fmt(p.commissionPct)}%</td>
      <td><button class="btn" data-del="${p.id}">Elimina</button></td>
    </tr>
  `).join('');
  propertyTable.innerHTML = head + `<tbody>${rows || '<tr><td colspan="4" style="color:#9fb0c9">Nessun immobile</td></tr>'}</tbody>`;
  // populate selects for monthly form and dashboard
  const opts = properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  recordProperty.innerHTML = opts;
  dashProperty.innerHTML = `<option value="">Tutti</option>` + opts;
  // events delete
  propertyTable.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del');
      // Remove property and related records
      properties = properties.filter(p => p.id !== id);
      records = records.filter(r => r.propertyId !== id);
      save();
      renderAll();
    });
  });
}

// Store ownerDisplay, propAddress, and cover image per property; store monthly notes
const propertyNotes = JSON.parse(localStorage.getItem('gr_demo_notes') || '{}');
const propertyImages = JSON.parse(localStorage.getItem('gr_demo_images') || '{}');

function savePropertyNotes() {
  localStorage.setItem('gr_demo_notes', JSON.stringify(propertyNotes));
}

function savePropertyImages() {
  localStorage.setItem('gr_demo_images', JSON.stringify(propertyImages));
}

// CSV import events
if (csvInput) {
  csvInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { alert('CSV vuoto o intestazioni non riconosciute.'); return; }
    importCSV(rows);
    alert(`Import completato: ${rows.length} righe.`);
    csvInput.value = '';
  });
}

// Reset demo data
if (resetDataBtn) {
  resetDataBtn.addEventListener('click', () => {
    if (!confirm('Confermi il reset di tutti i dati demo?')) return;
    localStorage.removeItem(LS_KEYS.props);
    localStorage.removeItem(LS_KEYS.records);
    localStorage.removeItem(LS_KEYS.brand);
    localStorage.removeItem(LS_KEYS.logo);
    properties = [];
    records = [];
    brand = {};
    logoDataUrl = '';
    renderAll();
    alert('Dati demo resettati');
  });
}

if (csvTemplate) {
  csvTemplate.addEventListener('click', (e) => {
    e.preventDefault();
    const headers = 'property,ownerType,commissionPct,year,month,airbnb,pulizie,altreSpese\n';
    const example = 'Casalbertone,PF,25,2025,3,2234.81,247,0\n';
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template_rendiconti.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
 

function initMonths() {
  recordMonth.innerHTML = months.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  const now = new Date();
  recordMonth.value = now.getMonth();
  recordYear.value = now.getFullYear();
  dashYear.value = now.getFullYear();
}

function getPropertyById(id) { return properties.find(p => p.id === id); }

function compute({ airbnb, pulizie, altreSpese, commissionPct, ownerType }) {
  const locazione = airbnb - pulizie - altreSpese;
  const comm = Math.max(0, locazione * (commissionPct / 100));
  const iva = comm * 0.22;
  const netto = locazione - comm - iva;
  const rit = ownerType === 'PF' ? Math.max(0, locazione * 0.21) : 0;
  const bonifico = netto - rit;
  return { locazione, comm, iva, netto, rit, bonifico };
}

function updatePreview() {
  const p = getPropertyById(recordProperty.value);
  const air = parseNum(airbnb.value);
  const pul = parseNum(pulizie.value);
  const alt = parseNum(altreSpese.value);
  const commission = p ? p.commissionPct : parseNum(commissionPct.value);
  const oType = p ? p.ownerType : ownerType.value;
  const res = compute({ airbnb: air, pulizie: pul, altreSpese: alt, commissionPct: commission, ownerType: oType });
  c_airbnb.textContent = fmt(air);
  c_pulizie.textContent = fmt(pul);
  c_altre.textContent = fmt(alt);
  c_locazione.textContent = fmt(res.locazione);
  c_comm.textContent = fmt(res.comm);
  c_iva.textContent = fmt(res.iva);
  c_netto.textContent = fmt(res.netto);
  c_rit.textContent = fmt(res.rit);
  c_bonifico.textContent = fmt(res.bonifico);
}

function renderAnnual() {
  const pid = dashProperty.value || null;
  const year = parseInt(dashYear.value, 10);
  // Build a 12-month table
  const headers = `<tr><th>Voce</th>${months.map(m=>`<th>${m}</th>`).join('')}<th>TOT</th></tr>`;
  const rows = [
    { key:'airbnb', label:'AIRBNB' },
    { key:'pulizie', label:'Pulizie' },
    { key:'altre', label:'Altre spese' },
    { key:'locazione', label:'Corrispettivo Locazione' },
    { key:'comm', label:'Commissione PM' },
    { key:'iva', label:'IVA 22%' },
    { key:'netto', label:'Corrispettivo netto' },
    { key:'rit', label:'Ritenuta 21%' },
    { key:'bonifico', label:'Netto corrisposto' },
  ];

  // Aggregate per month
  const acc = months.map(()=>({
    airbnb:0, pulizie:0, altre:0, locazione:0, comm:0, iva:0, netto:0, rit:0, bonifico:0
  }));

  records.filter(r => (!pid || r.propertyId === pid) && r.year === year)
    .forEach(r => {
      const p = getPropertyById(r.propertyId);
      const calc = compute({
        airbnb: r.airbnb,
        pulizie: r.pulizie,
        altreSpese: r.altreSpese || 0,
        commissionPct: p?.commissionPct || 0,
        ownerType: p?.ownerType || 'PF'
      });
      const m = acc[r.month];
      m.airbnb += r.airbnb;
      m.pulizie += r.pulizie;
      m.altre += r.altreSpese || 0;
      m.locazione += calc.locazione;
      m.comm += calc.comm;
      m.iva += calc.iva;
      m.netto += calc.netto;
      m.rit += calc.rit;
      m.bonifico += calc.bonifico;
    });

  const buildRow = (key,label) => {
    const t = acc.reduce((s,m)=>s+(m[key]||0),0);
    return `<tr><td>${label}</td>${acc.map(m=>`<td>${fmt(m[key])}</td>`).join('')}<td><strong>${fmt(t)}</strong></td></tr>`;
  };

  const html = `<table class="table">
    <thead>${headers}</thead>
    <tbody>
      ${rows.map(r=>buildRow(r.key, r.label)).join('')}
    </tbody>
  </table>`;
  annualTable.innerHTML = html;

  // Chart for bonifico trend
  const ctx = document.getElementById('annualChart');
  const data = acc.map(m=>+(m.bonifico.toFixed(2)));
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{ label: 'Netto corrisposto', data, backgroundColor: 'rgba(14,165,233,0.6)' }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#e8eef7' } } },
      scales: { x: { ticks: { color:'#9fb0c9' } }, y: { ticks: { color:'#9fb0c9' } } }
    }
  });
}

// CSV helpers
function monthToIndex(m) {
  if (typeof m === 'number') return Math.max(0, Math.min(11, m - 1));
  if (!m) return 0;
  const s = String(m).trim().toLowerCase();
  // number as string
  const num = parseInt(s, 10);
  if (!isNaN(num)) return Math.max(0, Math.min(11, num - 1));
  const map = {
    'gennaio':0,'febbraio':1,'marzo':2,'aprile':3,'maggio':4,'giugno':5,
    'luglio':6,'agosto':7,'settembre':8,'ottobre':9,'novembre':10,'dicembre':11
  };
  return map[s] ?? 0;
}

function parseCSV(text) {
  // very small CSV parser for comma-separated with optional headers
  // expects headers: property,ownerType,commissionPct,year,month,airbnb,pulizie,altreSpese
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map(h=>h.trim());
  const useHeader = ['property','ownerType','commissionPct','year','month','airbnb','pulizie','altreSpese']
    .every(k => header.includes(k));
  const start = useHeader ? 1 : 0;
  const idx = (k) => header.indexOf(k);
  const rows = [];
  for (let i=start;i<lines.length;i++) {
    const cols = lines[i].split(',').map(c=>c.trim());
    const get = (k, fallbackIndex) => useHeader ? cols[idx(k)] : cols[fallbackIndex];
    const rec = {
      property: get('property',0),
      ownerType: (get('ownerType',1) || 'PF').toString(),
      commissionPct: parseNum(get('commissionPct',2)),
      year: parseInt(get('year',3), 10),
      month: monthToIndex(get('month',4)),
      airbnb: parseNum(get('airbnb',5)),
      pulizie: parseNum(get('pulizie',6)),
      altreSpese: parseNum(get('altreSpese',7) || '0')
    };
    if (!rec.property || isNaN(rec.year)) continue;
    rows.push(rec);
  }
  return rows;
}

function importCSV(rows) {
  // ensure properties
  rows.forEach(r => {
    let p = properties.find(x => x.name.toLowerCase() === r.property.toLowerCase());
    if (!p) {
      p = { id: uid(), name: r.property, ownerType: (r.ownerType === 'Societa' ? 'Societa' : 'PF'), commissionPct: r.commissionPct || 0 };
      properties.push(p);
    } else {
      // update commission/type if provided
      if (!isNaN(r.commissionPct) && r.commissionPct>0) p.commissionPct = r.commissionPct;
      if (r.ownerType) p.ownerType = (r.ownerType === 'Societa' ? 'Societa' : 'PF');
    }
  });

  // add/update records
  rows.forEach(r => {
    const p = properties.find(x => x.name.toLowerCase() === r.property.toLowerCase());
    if (!p) return;
    const newRec = {
      id: uid(), propertyId: p.id, year: r.year, month: r.month,
      airbnb: r.airbnb, pulizie: r.pulizie, altreSpese: r.altreSpese
    };
    const idx = records.findIndex(x => x.propertyId === newRec.propertyId && x.year === newRec.year && x.month === newRec.month);
    if (idx >= 0) records[idx] = newRec; else records.push(newRec);
  });
  save();
  renderAll();
}

function toPDF(record) {
  const p = getPropertyById(record.propertyId);
  const calc = compute({
    airbnb: record.airbnb, pulizie: record.pulizie, altreSpese: record.altreSpese || 0,
    commissionPct: p?.commissionPct || 0, ownerType: p?.ownerType || 'PF'
  });
  const color = brand.color || '#487667';
  const name = brand.name || 'Gestione Rendiconti';

  // Page 1: compact cover to avoid page split
  const cover = `
    <div style="page-break-after:always;padding:16px;margin:0;background:#ffffff;color:#111">
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff">
        <div style="background:${color}26;height:96px;display:flex;align-items:center;justify-content:flex-end;padding:10px">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="logo" style="height:32px"/>` : ''}
        </div>
        <div style="padding:16px">
          <div style="font-size:22px;font-weight:700;color:#111">Report mensile</div>
          <div style="color:#374151">${months[record.month]} ${record.year}</div>
          <div style="margin-top:10px;color:#111;font-weight:600">${p?.ownerDisplay || ''}</div>
          <div style="color:#374151">${p?.address || ''}</div>
          ${p?.cover ? `<img src="${p.cover}" alt="cover" style="width:100%;height:220px;object-fit:cover;margin-top:12px;border:1px solid #e5e7eb"/>` : ''}
        </div>
      </div>
    </div>`;

  const header = `
    <div class="pdf-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="pdf-brand" style="display:flex;align-items:center;gap:10px">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="logo" style="height:26px"/>` : ''}
        <div>
          <div class="pdf-title" style="font-size:18px;font-weight:700;color:#111">${name}</div>
          <div style="font-size:12px;color:#6b7280">Rendiconto Mensile</div>
        </div>
      </div>
      <div class="dot" style="width:10px;height:10px;border-radius:50%;background:${color}"></div>
    </div>`;

  const notesBlock = record.notes ? `<div style="margin-top:10px"><div style="color:${color};font-weight:700;margin-bottom:6px">NOTE</div><div style="color:#111;white-space:pre-wrap">${record.notes}</div></div>` : '';

  const table = `
    <table class="pdf-table" style="width:100%;border-collapse:collapse;margin-top:14px;font-size:12px;color:#111;background:#ffffff;page-break-inside:auto">
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">Immobile</td>
        <td style="border:1px solid #cbd5e1;padding:8px">${p?.name || ''}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">Mese</td>
        <td style="border:1px solid #cbd5e1;padding:8px">${months[record.month]} ${record.year}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">AIRBNB</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(record.airbnb)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">Pulizie</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(record.pulizie)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">Altre spese</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(record.altreSpese || 0)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">Corrispettivo Locazione</td>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">€ ${fmt(calc.locazione)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">Commissione gestione (${fmt(p?.commissionPct||0)}%)</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(calc.comm)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">IVA 22%</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(calc.iva)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">Corrispettivo netto</td>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:700">€ ${fmt(calc.netto)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px">Ritenuta 21% ${p?.ownerType==='PF' ? '' : '(non applicata)'}</td>
        <td style="border:1px solid #cbd5e1;padding:8px">€ ${fmt(calc.rit)}</td>
      </tr>
      <tr>
        <td style="border:2px solid #0f172a;padding:10px;font-weight:800">Netto da bonificare</td>
        <td style="border:2px solid #0f172a;padding:10px;font-weight:800">€ ${fmt(calc.bonifico)}</td>
      </tr>
    </table>
    ${notesBlock}`;

  pdfContainer.style.display = 'block';
  const content = `<div style="padding:16px;background:#ffffff;color:#111">${header}${table}</div>`;
  pdfContainer.innerHTML = cover + content;

  const opt = {
    margin:       10,
    filename:     `Rendiconto_${(p?.name||'immobile').replace(/\s+/g,'_')}_${record.year}_${record.month+1}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    pagebreak:    { mode: ['css', 'legacy'] },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(pdfContainer).save().then(()=>{
    pdfContainer.style.display = 'none';
  });
}

function renderAll() {
  renderProperties();
  updatePreview();
  renderAnnual();
  // fill selects for forms
  if (properties.length === 0) {
    recordProperty.innerHTML = '';
    dashProperty.innerHTML = '<option value="">Tutti</option>';
  }
  // debug text
  if (debugInfo) {
    debugInfo.textContent = `Immobili salvati: ${properties.length} | Record mensili: ${records.length}`;
  }
  // status bar
  const status = document.getElementById('statusBar');
  if (status) status.textContent = `Stato: JS attivo · Immobili: ${properties.length} · Record: ${records.length}`;
}

// Event listeners
propertyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = byId('propName').value.trim();
  const oType = ownerType.value;
  const cPct = parseNum(commissionPct.value);
  if (!name) return;
  const base = { id: uid(), name, ownerType: oType, commissionPct: cPct,
    ownerDisplay: (ownerDisplay.value||'').trim(), address: (propAddress.value||'').trim(), cover: '' };
  const file = propCover.files && propCover.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      base.cover = reader.result;
      properties.push(base);
      byId('propName').value = '';
      ownerDisplay.value=''; propAddress.value=''; propCover.value='';
      save();
      renderAll();
      // auto-select new property and confirm
      recordProperty.value = base.id;
      dashProperty.value = base.id;
      alert('Immobile aggiunto');
      const status = document.getElementById('statusBar');
      if (status) status.textContent = `Aggiunto: ${base.name}`;
    };
    reader.readAsDataURL(file);
  } else {
    properties.push(base);
    byId('propName').value = '';
    ownerDisplay.value=''; propAddress.value=''; propCover.value='';
    save();
    renderAll();
    recordProperty.value = base.id;
    dashProperty.value = base.id;
    alert('Immobile aggiunto');
    const status = document.getElementById('statusBar');
    if (status) status.textContent = `Aggiunto: ${base.name}`;
  }
});

[airbnb, pulizie, altreSpese, recordProperty].forEach(el => el.addEventListener('input', updatePreview));

recordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!recordProperty.value) { alert('Aggiungi prima un immobile'); return; }
  const r = {
    id: uid(),
    propertyId: recordProperty.value,
    month: parseInt(recordMonth.value, 10),
    year: parseInt(recordYear.value, 10),
    airbnb: parseNum(airbnb.value),
    pulizie: parseNum(pulizie.value),
    altreSpese: parseNum(altreSpese.value),
    notes: (notesEl.value||'').trim()
  };
  // Replace if same property-month-year exists
  const idx = records.findIndex(x => x.propertyId === r.propertyId && x.month === r.month && x.year === r.year);
  if (idx >= 0) records[idx] = r; else records.push(r);
  save();
  renderAnnual();
  alert('Mese salvato');
});

refreshDash.addEventListener('click', renderAnnual);

brandName.addEventListener('input', () => { brand.name = brandName.value; save(); });
brandColor.addEventListener('input', () => { brand.color = brandColor.value; save(); });

logoInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { logoDataUrl = reader.result; save(); };
  reader.readAsDataURL(file);
});

downloadPDF.addEventListener('click', () => {
  // choose selected month/year/property from the input section
  if (!recordProperty.value) { alert('Seleziona un immobile nella sezione 2'); return; }
  const m = parseInt(recordMonth.value, 10);
  const y = parseInt(recordYear.value, 10);
  const r = records.find(x => x.propertyId === recordProperty.value && x.month === m && x.year === y);
  if (!r) { alert('Nessun record salvato per il mese selezionato. Salva prima il mese.'); return; }
  toPDF(r);
});

// Preview PDF directly from current inputs (without saving)
if (previewPDFBtn) {
  previewPDFBtn.addEventListener('click', () => {
    if (!recordProperty.value) { alert('Seleziona un immobile nella sezione 2'); return; }
    const temp = {
      id: 'preview',
      propertyId: recordProperty.value,
      month: parseInt(recordMonth.value, 10),
      year: parseInt(recordYear.value, 10),
      airbnb: parseNum(airbnb.value),
      pulizie: parseNum(pulizie.value),
      altreSpese: parseNum(altreSpese.value),
      notes: (notesEl?.value || '').trim(),
    };
    toPDF(temp);
  });
}

// Initialize months, brand UI, and render
(function init(){
  initMonths();
  brandName.value = brand.name || '';
  brandColor.value = brand.color || '#487667';
  renderAll();
})();
