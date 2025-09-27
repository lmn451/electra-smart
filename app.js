// Minimal vanilla UI logic adapted to /api endpoints with header-based auth
const endpoints = {
  listDevices: '/api/devices',
  deviceStatus: (id) => `/api/status/${encodeURIComponent(id)}`,
  sendCommand: '/api/command',
  power: '/api/power',
  authStart: '/api/auth/start',
  authVerify: '/api/auth/verify',
};

const state = {
  devices: [],
  statusMap: new Map(),
  timerId: null,
  autoSec: 5,
  autoEnabled: true,
  pendingImei: '',
};

const CREDS_KEY = 'electraCreds';

function getCreds() {
  try {
    const s = sessionStorage.getItem(CREDS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  try {
    const l = localStorage.getItem(CREDS_KEY);
    if (l) return JSON.parse(l);
  } catch {}
  return null;
}

function setCreds(creds, remember) {
  clearCreds();
  const json = JSON.stringify(creds);
  if (remember) localStorage.setItem(CREDS_KEY, json);
  else sessionStorage.setItem(CREDS_KEY, json);
}

function clearCreds() {
  sessionStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(CREDS_KEY);
}

async function apiFetch(url, options = {}) {
  const creds = getCreds();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (url.startsWith('/api/') && creds) {
    headers['X-Electra-IMEI'] = creds.imei;
    headers['X-Electra-Token'] = creds.token;
  }
  const res = await fetch(url, {
    headers,
    cache: 'no-cache',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'dataset') Object.entries(v).forEach(([dk,dv]) => e.dataset[dk] = dv);
    else e.setAttribute(k, v);
  });
  children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function setStatusLine(text) {
  const elStatus = document.getElementById('statusLine');
  if (elStatus) elStatus.textContent = text || '';
}

function setAutoStatus(text) {
  const elAuto = document.getElementById('autoStatus');
  if (elAuto) elAuto.textContent = text || '';
}

function updateAuthUI() {
  const panel = document.getElementById('authPanel');
  const creds = getCreds();
  if (panel) panel.classList.toggle('hidden', !!creds);
  const authStatus = document.getElementById('authStatus');
  if (authStatus) authStatus.textContent = creds ? `Signed in (IMEI ${creds.imei})` : 'Not signed in';
}

function updateAutoRefreshUI() {
  const chk = document.getElementById('autoRefreshChk');
  const secInput = document.getElementById('autoRefreshSec');
  if (chk) chk.checked = !!state.autoEnabled;
  if (secInput && state.autoSec) secInput.value = String(state.autoSec);
  const running = !!state.timerId;
  if (!state.autoEnabled) {
    setAutoStatus('Auto-refresh: Off');
  } else if (!running) {
    setAutoStatus('Auto-refresh: Paused');
  } else {
    setAutoStatus(`Auto-refresh: On (${state.autoSec}s)`);
  }
}

async function loadDevices() {
  const container = document.getElementById('devices');
  container.innerHTML = '';
  if (!getCreds()) {
    setStatusLine('Sign in to view devices');
    return;
  }
  setStatusLine('Loading devices…');
  try {
    const devices = await apiFetch(endpoints.listDevices);
    state.devices = Array.isArray(devices) ? devices : (devices.devices || []);
    renderDeviceCards(state.devices);
    await Promise.all(state.devices.map(d => refreshDevice(d.id)));
    setStatusLine('');
  } catch (e) {
    setStatusLine('Failed to load devices');
    container.appendChild(el('div', { class: 'empty', text: `Failed to load devices: ${e.message}` }));
  }
}

function renderDeviceCards(devices) {
  const container = document.getElementById('devices');
  container.classList.add('cards');
  container.innerHTML = '';
  if (!devices.length) {
    container.appendChild(el('div', { class: 'empty', text: 'No devices found.' }));
    return;
  }
  devices.forEach(d => {
    const id = (d.id ?? d.imei ?? d.device_id ?? d.name ?? 'unknown').toString();
    const title = d.name ? `${d.name} — ${id}` : `Device ${id}`;
    const card = el('div', { class: 'card', dataset: { id: String(id) } },
      el('div', { class: 'header' },
        el('div', { class: 'title', text: title }),
        el('div', { class: 'badge', id: `badge-${id}` }, '—')
      ),
      el('div', { class: 'grid' },
        el('div', { class: 'kv' }, el('span', { class: 'k', text: 'Mode' }), el('span', { id: `mode-${id}`, text: '—' })),
        el('div', { class: 'kv' }, el('span', { class: 'k', text: 'Fan' }), el('span', { id: `fan-${id}`, text: '—' })),
        el('div', { class: 'kv' }, el('span', { class: 'k', text: 'Setpoint' }), el('span', { id: `spt-${id}`, text: '—' })),
        el('div', { class: 'kv' }, el('span', { class: 'k', text: 'Current' }), el('span', { id: `cur-${id}`, text: '—' })),
      ),
      el('div', { class: 'controls' },
        buildModeSelect(id),
        buildFanSelect(id),
        buildTempControl(id),
        el('button', { id: `apply-${id}`, class: 'btn primary' }, 'Apply'),
        el('button', { id: `refresh-${id}`, class: 'btn secondary' }, 'Refresh'),
      ),
      el('div', { class: 'actions' },
        el('button', { id: `power-on-${id}`, class: 'btn' }, 'Power On'),
        el('button', { id: `power-off-${id}`, class: 'btn' }, 'Power Off')
      )
    );
    container.appendChild(card);

    document.getElementById(`refresh-${id}`).onclick = () => refreshDevice(id);
    document.getElementById(`apply-${id}`).onclick = () => applyChanges(id);
    document.getElementById(`power-on-${id}`).onclick = () => togglePower(id, true);
    document.getElementById(`power-off-${id}`).onclick = () => togglePower(id, false);
    const dec = document.getElementById(`tdec-${id}`);
    const inc = document.getElementById(`tinc-${id}`);
    if (dec) dec.onclick = () => stepTemp(id, -1);
    if (inc) inc.onclick = () => stepTemp(id, +1);
  });
}

function buildModeSelect(id) {
  const sel = el('select', { id: `modeSel-${id}` },
    el('option', { value: '', text: 'Mode…' }),
    el('option', { value: 'STBY', text: 'STBY (Standby)' }),
    el('option', { value: 'COOL', text: 'COOL' }),
    el('option', { value: 'FAN', text: 'FAN' }),
    el('option', { value: 'DRY', text: 'DRY' }),
    el('option', { value: 'HEAT', text: 'HEAT' }),
    el('option', { value: 'AUTO', text: 'AUTO' }),
  );
  return sel;
}

function buildFanSelect(id) {
  const sel = el('select', { id: `fanSel-${id}` },
    el('option', { value: '', text: 'Fan…' }),
    el('option', { value: 'LOW', text: 'LOW' }),
    el('option', { value: 'MED', text: 'MED' }),
    el('option', { value: 'HIGH', text: 'HIGH' }),
    el('option', { value: 'AUTO', text: 'AUTO' }),
  );
  return sel;
}

function buildTempControl(id){
  const wrap = el('div', { class: 'tempctl' },
    el('button', { id: `tdec-${id}`, class: 'btn' }, '−'),
    el('input', { id: `temp-${id}`, type: 'number', inputmode: 'numeric', placeholder: 'Temp °C', min: '10', max: '35', step: '1' }),
    el('button', { id: `tinc-${id}`, class: 'btn' }, '+'),
  );
  return wrap;
}

async function refreshDevice(id) {
  try {
    const s = await apiFetch(endpoints.deviceStatus(id));
    const fields = mapStatusFields(s);
    state.statusMap.set(String(id), fields);
    paintStatus(id, fields);
  } catch (e) {
    setStatusLine(`Status error for ${id}: ${e.message}`);
  }
}

function mapStatusFields(s) {
  const cj = s?.commandJson || {};
  const operoper = cj?.OPER?.OPER || {};
  const diag = cj?.DIAG_L2?.DIAG_L2 || {};
  const hasFlag = Object.prototype.hasOwnProperty.call(operoper, 'TURN_ON_OFF');
  const isOn = hasFlag ? (operoper.TURN_ON_OFF !== 'OFF') : (operoper.AC_MODE !== 'STBY');
  return {
    isOn,
    mode: operoper.AC_MODE ?? 'STBY',
    fan: operoper.FANSPD ?? 'OFF',
    spt: operoper.SPT ?? null,
    current: pickCurrentTemp(diag),
    raw: s,
  };
}

function pickCurrentTemp(diagL2) {
  if (!diagL2) return null;
  const keys = ['I_RAT','I_CALC_AT','I_RCT'];
  for (const k of keys) {
    const v = diagL2[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= -5 && n <= 42) return n;
    }
  }
  return null;
}

function paintStatus(id, fields) {
  const bade = document.getElementById(`badge-${id}`);
  if (bade) {
    bade.textContent = fields.isOn ? 'ON' : 'OFF';
    bade.classList.toggle('on', fields.isOn);
    bade.classList.toggle('off', !fields.isOn);
  }
  const m = document.getElementById(`mode-${id}`);
  if (m) m.textContent = fields.mode ?? '—';
  const f = document.getElementById(`fan-${id}`);
  if (f) f.textContent = fields.fan ?? '—';
  const sp = document.getElementById(`spt-${id}`);
  if (sp) sp.textContent = fields.spt ?? '—';
  const cur = document.getElementById(`cur-${id}`);
  if (cur) cur.textContent = fields.current ?? '—';
  const tempInput = document.getElementById(`temp-${id}`);
  if (tempInput && !tempInput.value && fields.spt != null) tempInput.value = String(fields.spt);
}

function stepTemp(id, delta){
  const input = document.getElementById(`temp-${id}`);
  if (!input) return;
  const min = Number(input.min || 10);
  const max = Number(input.max || 35);
  const cur = Number(input.value || 24);
  const next = Math.min(max, Math.max(min, cur + delta));
  input.value = String(next);
}

async function applyChanges(id) {
  const modeSel = document.getElementById(`modeSel-${id}`);
  const fanSel = document.getElementById(`fanSel-${id}`);
  const tempInput = document.getElementById(`temp-${id}`);
  const body = { ac_id: id };
  if (modeSel && modeSel.value) body.mode = modeSel.value;
  if (fanSel && fanSel.value) body.fan = fanSel.value;
  if (tempInput && tempInput.value) body.temperature = Number(tempInput.value);
  if (!body.mode && !body.fan && body.temperature === undefined) {
    setStatusLine('Nothing to apply');
    return;
  }
  try {
    await apiFetch(endpoints.sendCommand, { method: 'POST', body: JSON.stringify(body) });
    setStatusLine(`Applied to ${id}`);
    await refreshDevice(id);
  } catch (e) {
    setStatusLine(`Apply error for ${id}: ${e.message}`);
  }
}

async function togglePower(id, turnOn) {
  try {
    await apiFetch(endpoints.power, { method: 'POST', body: JSON.stringify({ ac_id: id, on: turnOn }) });
    setStatusLine(`Power ${turnOn ? 'On' : 'Off'} sent to ${id}`);
    await refreshDevice(id);
  } catch (e) {
    setStatusLine(`Power toggle error for ${id}: ${e.message}`);
  }
}

function applyAutoRefresh(enabled, sec) {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  const seconds = Math.max(1, Number(sec) || 5);
  state.autoEnabled = !!enabled;
  state.autoSec = seconds;
  if (state.autoEnabled) {
    state.timerId = setInterval(() => {
      state.devices.forEach(d => refreshDevice(d.id));
    }, seconds * 1000);
  }
  updateAutoRefreshUI();
}

async function sendOtp() {
  const phoneInput = document.getElementById('phoneInput');
  const imeiOutput = document.getElementById('imeiOutput');
  const authStatus = document.getElementById('authStatus');
  const phone = (phoneInput?.value || '').trim();
  if (!phone) { authStatus.textContent = 'Enter phone number'; return; }
  try {
    const res = await apiFetch(endpoints.authStart, { method: 'POST', body: JSON.stringify({ phone }) });
    const imei = res?.imei;
    if (!imei) throw new Error('No IMEI returned');
    state.pendingImei = imei;
    if (imeiOutput) imeiOutput.value = imei;
    authStatus.textContent = 'Code sent';
  } catch (e) {
    authStatus.textContent = `Send failed: ${e.message}`;
  }
}

async function verifyOtp() {
  const phoneInput = document.getElementById('phoneInput');
  const imeiOutput = document.getElementById('imeiOutput');
  const codeInput = document.getElementById('codeInput');
  const rememberChk = document.getElementById('rememberChk');
  const authStatus = document.getElementById('authStatus');
  const phone = (phoneInput?.value || '').trim();
  const code = (codeInput?.value || '').trim();
  const imei = (imeiOutput?.value || state.pendingImei || '').trim();
  if (!phone || !code || !imei) { authStatus.textContent = 'Enter phone, IMEI and code'; return; }
  try {
    const res = await apiFetch(endpoints.authVerify, { method: 'POST', body: JSON.stringify({ imei, phone, code }) });
    const token = res?.token;
    if (!token) throw new Error('No token');
    setCreds({ imei, token }, !!rememberChk?.checked);
    updateAuthUI();
    authStatus.textContent = 'Signed in';
    await loadDevices();
  } catch (e) {
    authStatus.textContent = `Verify failed: ${e.message}`;
  }
}

function initUI() {
  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', loadDevices);

  const chk = document.getElementById('autoRefreshChk');
  const secInput = document.getElementById('autoRefreshSec');
  if (chk && secInput) {
    chk.addEventListener('change', () => applyAutoRefresh(chk.checked, Number(secInput.value || 5)));
    secInput.addEventListener('change', () => applyAutoRefresh(chk.checked, Number(secInput.value || 5)));
    // Start auto-refresh immediately based on current UI state
    applyAutoRefresh(chk.checked, Number(secInput.value || 5));
  }

  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyBtn = document.getElementById('verifyBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (sendOtpBtn) sendOtpBtn.addEventListener('click', sendOtp);
  if (verifyBtn) verifyBtn.addEventListener('click', verifyOtp);
  if (logoutBtn) logoutBtn.addEventListener('click', () => { clearCreds(); updateAuthUI(); setStatusLine('Signed out'); });

  // Pause/resume auto-refresh when tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      updateAutoRefreshUI();
    } else if (state.autoEnabled) {
      applyAutoRefresh(true, state.autoSec);
    }
  });

  updateAuthUI();
  if (getCreds()) loadDevices();
}

window.addEventListener('DOMContentLoaded', initUI);
