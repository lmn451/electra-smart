// Cloudflare Pages Functions Electra client with OTP and per-credentials SID cache
const URL = 'https://app.ecpiot.co.il/mobile/mobilecommand';
const HEADERS = { 'user-agent': 'Electra Client', 'content-type': 'application/json', 'accept': 'application/json' };
const OS_FINGERPRINT = { os: 'android', osver: 'M4B30Z' };

// Per-credentials SID cache (keyed by imei|token)
const sidCache = new Map(); // key -> { sid: string, exp: epochSeconds }
const SID_TTL_SECONDS = 60;

function now() { return Math.floor(Date.now() / 1000); }
function cacheKey(creds) { return `${creds?.imei || ''}|${creds?.token || ''}`; }

function requireImei(creds) {
  if (!creds || !creds.imei || typeof creds.imei !== 'string') {
    throw { status: 400, error: 'bad_request', message: 'imei required' };
  }
}

async function rpcPost(cmd, data, sid, withOsDetails) {
  const payload = {
    pvdid: 1,
    id: Math.floor(1000 + Math.random() * 1000),
    sid: sid || null,
    cmd,
    data: { ...data, ...(withOsDetails ? OS_FINGERPRINT : {}) },
  };
  const res = await fetch(URL, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
  let json;
  try { json = await res.json(); } catch (e) { throw { status: 502, error: 'invalid_json', details: String(e) }; }
  const dataObj = json?.data;
  if (json?.status !== 0 || !dataObj || dataObj?.res !== 0) {
    throw { status: 502, error: 'upstream_error', res_desc: dataObj?.res_desc || 'Upstream error', raw: json };
  }
  return dataObj;
}

async function refreshSid(creds) {
  requireImei(creds);
  if (!creds.token) throw { status: 401, error: 'missing_credentials', message: 'token required' };
  const data = await rpcPost('VALIDATE_TOKEN', { imei: creds.imei, token: creds.token }, null, true);
  const entry = { sid: data.sid, exp: now() + SID_TTL_SECONDS };
  sidCache.set(cacheKey(creds), entry);
  return entry.sid;
}

async function getSid(creds) {
  const key = cacheKey(creds);
  const entry = sidCache.get(key);
  if (!entry || now() >= entry.exp) {
    return await refreshSid(creds);
  }
  return entry.sid;
}

async function postWithSid(creds, cmd, data, withOsDetails) {
  const sid = await getSid(creds);
  try {
    return await rpcPost(cmd, data, sid, withOsDetails);
  } catch (e) {
    // Retry once on SID issues
    await refreshSid(creds);
    return await rpcPost(cmd, data, await getSid(creds), withOsDetails);
  }
}

function parseCommandJson(d) {
  const cj = d?.commandJson || {};
  const parsed = {};
  for (const [k, v] of Object.entries(cj)) {
    if (typeof v === 'string' && v !== 'null' && v !== 'None' && v !== '') {
      try { parsed[k] = JSON.parse(v); } catch { parsed[k] = v; }
    } else {
      parsed[k] = v;
    }
  }
  return { ...d, commandJson: parsed };
}

// OTP flows (no token required)
export async function sendOtp(creds, phone) {
  requireImei(creds);
  if (!phone || typeof phone !== 'string') throw { status: 400, error: 'bad_request', message: 'phone required' };
  // Some upstreams require OS fingerprint for OTP flows too; include it
  await rpcPost('SEND_OTP', { imei: creds.imei, phone }, null, true);
  return true;
}

export async function verifyOtp(creds, phone, code) {
  requireImei(creds);
  if (!phone || typeof phone !== 'string') throw { status: 400, error: 'bad_request', message: 'phone required' };
  if (!code || !/^[0-9]{4,8}$/.test(String(code))) throw { status: 400, error: 'bad_request', message: 'code invalid' };
  const data = await rpcPost('CHECK_OTP', { imei: creds.imei, phone, code }, null, true);
  return data?.token;
}

// Authenticated device/control APIs (token required)
export async function listDevices(creds) {
  const data = await postWithSid(creds, 'GET_DEVICES', {});
  return data.devices || [];
}

export async function getStatusRaw(creds, ac_id) {
  return await postWithSid(creds, 'GET_LAST_TELEMETRY', { id: ac_id, commandName: 'OPER,DIAG_L2,HB' });
}

export async function getStatus(creds, ac_id) {
  const d = await getStatusRaw(creds, ac_id);
  return parseCommandJson(d);
}

export async function getTelemetry(creds, ac_id, groups) {
  const d = await postWithSid(creds, 'GET_LAST_TELEMETRY', { id: ac_id, commandName: groups });
  return parseCommandJson(d);
}

export async function sendCommand(creds, ac_id, oper) {
  const payload = { id: ac_id, commandJson: JSON.stringify({ OPER: oper }) };
  return await postWithSid(creds, 'SEND_COMMAND', payload);
}

export async function sendOperMerge(creds, ac_id, changes) {
  const parsed = await getStatus(creds, ac_id);
  const oper = (((parsed?.commandJson || {}).OPER || {}).OPER) || {};
  const newOper = { ...oper };
  if ('SPT' in changes && 'SPT' in oper) {
    const baseVal = oper.SPT;
    const chgVal = changes.SPT;
    if (Number.isInteger(baseVal) && !Number.isInteger(chgVal)) changes = { ...changes, SPT: parseInt(chgVal, 10) };
    if (typeof baseVal === 'string' && typeof chgVal !== 'string') changes = { ...changes, SPT: String(chgVal) };
  }
  Object.assign(newOper, changes);
  return await sendCommand(creds, ac_id, newOper);
}
