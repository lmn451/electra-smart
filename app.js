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
  pendingPhone: '',
  resendTimerId: null,
  resendSec: 30,
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
  const logoutRow = document.getElementById('logoutRow');
  const toolbar = document.getElementById('toolbar');
  const creds = getCreds();
  if (panel) panel.classList.toggle('hidden', !!creds);
  if (logoutRow) logoutRow.classList.toggle('hidden', !creds);
  if (toolbar) toolbar.classList.toggle('hidden', !creds);
  const authStatus = document.getElementById('authStatus');
  if (authStatus) authStatus.textContent = creds ? `Signed in (IMEI ${creds.imei})` : 'Not signed in';
}

function showStep(step) {
  const stepPhone = document.getElementById('stepPhone');
  const stepCode = document.getElementById('stepCode');
  if (!stepPhone || !stepCode) return;
  if (step === 'phone') {
    stepPhone.classList.remove('hidden');
    stepCode.classList.add('hidden');
    const inp = document.getElementById('phoneInput');
    if (inp) inp.focus();
  } else {
    stepPhone.classList.add('hidden');
    stepCode.classList.remove('hidden');
    const first = document.getElementById('otp-1');
    if (first) first.focus();
  }
}

function getOtpInputs() {
  return [1,2,3,4].map(i => document.getElementById(`otp-${i}`)).filter(Boolean);
}

function clearOtpInputs() {
  getOtpInputs().forEach(inp => { inp.value = ''; });
}

function readOtpValue() {
  return getOtpInputs().map(inp => (inp.value || '').trim()).join('');
}

function startResendTimer() {
  const countdown = document.getElementById('resendCountdown');
  const resendBtn = document.getElementById('resendBtn');
  let remaining = state.resendSec;
  if (resendBtn) resendBtn.disabled = true;
  if (countdown) countdown.textContent = `You can resend in ${remaining}s`;
  if (state.resendTimerId) clearInterval(state.resendTimerId);
  state.resendTimerId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(state.resendTimerId);
      state.resendTimerId = null;
      if (countdown) countdown.textContent = '';
      if (resendBtn) resendBtn.disabled = false;
    } else {
      if (countdown) countdown.textContent = `You can resend in ${remaining}s`;
    }
  }, 1000);
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

async function sendOtp(isResend = false) {
  const phoneInput = document.getElementById('phoneInput');
  const imeiOutput = document.getElementById('imeiOutput');
  const authStatus = document.getElementById('authStatus');
  const phoneEcho = document.getElementById('phoneEcho');
  const sendBtn = document.getElementById('sendOtpBtn');
  const resendBtn = document.getElementById('resendBtn');
  const phone = (phoneInput?.value || state.pendingPhone || '').trim();
  if (!phone) { if (authStatus) authStatus.textContent = 'Enter phone number'; return; }
  try {
    if (sendBtn) sendBtn.disabled = true;
    if (resendBtn) resendBtn.disabled = true;
    const payload = isResend && state.pendingImei ? { phone, imei: state.pendingImei } : { phone };
    const res = await apiFetch(endpoints.authStart, { method: 'POST', body: JSON.stringify(payload) });
    const imei = res?.imei;
    if (!imei) throw new Error('No IMEI returned');
    state.pendingImei = imei;
    state.pendingPhone = phone;
    if (imeiOutput) imeiOutput.value = imei;
    if (authStatus) authStatus.textContent = 'Code sent';
    if (phoneEcho) phoneEcho.textContent = phone;
    clearOtpInputs();
    showStep('code');
    startResendTimer();
  } catch (e) {
    if (authStatus) authStatus.textContent = `Send failed: ${e.message}`;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function verifyOtp() {
  const phoneInput = document.getElementById('phoneInput');
  const imeiOutput = document.getElementById('imeiOutput');
  const rememberChk = document.getElementById('rememberChk');
  const authStatus = document.getElementById('authStatus');
  const phone = (phoneInput?.value || state.pendingPhone || '').trim();
  const code = readOtpValue();
  const imei = (imeiOutput?.value || state.pendingImei || '').trim();
  if (!phone || !code || !imei) { if (authStatus) authStatus.textContent = 'Enter phone and full code'; return; }
  try {
    const res = await apiFetch(endpoints.authVerify, { method: 'POST', body: JSON.stringify({ imei, phone, code }) });
    const token = res?.token;
    if (!token) throw new Error('No token');
    setCreds({ imei, token }, !!rememberChk?.checked);
    updateAuthUI();
    if (authStatus) authStatus.textContent = 'Signed in';
    await loadDevices();
  } catch (e) {
    if (authStatus) authStatus.textContent = `Verify failed: ${e.message}`;
  }
}

function initUI() {
  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', loadDevices);

  const chk = document.getElementById('autoRefreshChk');
  const secInput = document.getElementById('autoRefreshSec');
  if (chk && secInput) {
    chk.addEventListener('change', () => applyAutoRefresh(chk.checked, Number(secInput.value || 60)));
    secInput.addEventListener('change', () => applyAutoRefresh(chk.checked, Number(secInput.value || 60)));
    // Start auto-refresh immediately based on current UI state
    applyAutoRefresh(chk.checked, Number(secInput.value || 60));
  }

  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyBtn = document.getElementById('verifyBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const editPhoneLink = document.getElementById('editPhoneLink');
  const resendBtn = document.getElementById('resendBtn');
  if (sendOtpBtn) sendOtpBtn.addEventListener('click', () => sendOtp(false));
  if (resendBtn) resendBtn.addEventListener('click', () => sendOtp(true));
  if (verifyBtn) verifyBtn.addEventListener('click', verifyOtp);
  if (logoutBtn) logoutBtn.addEventListener('click', () => { clearCreds(); updateAuthUI(); setStatusLine('Signed out'); showStep('phone'); });
  if (editPhoneLink) editPhoneLink.addEventListener('click', () => { state.pendingImei=''; state.pendingPhone=''; clearOtpInputs(); showStep('phone'); });

  // OTP inputs UX
  const inputs = getOtpInputs();
  inputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0,1);
      if (inp.value && idx < inputs.length - 1) inputs[idx+1].focus();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        inputs[idx-1].focus();
      }
      if (e.key === 'ArrowLeft' && idx > 0) inputs[idx-1].focus();
      if (e.key === 'ArrowRight' && idx < inputs.length - 1) inputs[idx+1].focus();
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (text && /\d{4,6}/.test(text)) {
        e.preventDefault();
        const digits = text.replace(/\D/g, '').slice(0,6).split('');
        inputs.forEach((el, i) => { el.value = digits[i] || ''; });
        (inputs[digits.length-1] || inputs[inputs.length-1]).focus();
      }
    });
  });

  // Pause/resume auto-refresh when tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      updateAutoRefreshUI();
    } else if (state.autoEnabled) {
      applyAutoRefresh(true, state.autoSec);
    }
  });

  // Online/offline indicator for auth flow
  window.addEventListener('offline', () => {
    const authStatus = document.getElementById('authStatus');
    if (authStatus) authStatus.textContent = 'You are offline';
  });
  window.addEventListener('online', () => {
    const authStatus = document.getElementById('authStatus');
    if (authStatus) authStatus.textContent = '';
  });

  updateAuthUI();
  showStep(getCreds() ? 'code' : 'phone');
  if (getCreds()) loadDevices();
}

window.addEventListener('DOMContentLoaded', initUI);
