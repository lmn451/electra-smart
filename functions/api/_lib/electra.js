// Cloudflare Pages Functions shared Electra client (JS port of electra_backend/electra_api.py)
const URL = 'https://app.ecpiot.co.il/mobile/mobilecommand';
const HEADERS = { 'user-agent': 'Electra Client', 'content-type': 'application/json' };
const OS_FINGERPRINT = { os: 'android', osver: 'M4B30Z' };

let sharedSid = null;
let sharedSidExp = 0; // epoch seconds
const SHARED_TTL_SECONDS = 60;

function now() { return Math.floor(Date.now() / 1000); }

async function rpcPost(cmd, data, sid, osDetails) {
  const payload = {
    pvdid: 1,
    id: Math.floor(1000 + Math.random() * 1000),
    sid: sid || null,
    cmd,
    data: { ...data, ...(osDetails ? OS_FINGERPRINT : {}) },
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

async function refreshSid(env) {
  const data = await rpcPost('VALIDATE_TOKEN', { imei: env.ELECTRA_IMEI, token: env.ELECTRA_TOKEN }, null, true);
  sharedSid = data.sid;
  sharedSidExp = now() + SHARED_TTL_SECONDS;
  return sharedSid;
}

async function sidValue(env) {
  if (!sharedSid || now() >= sharedSidExp) {
    await refreshSid(env);
  }
  return sharedSid;
}

async function postWithSid(env, cmd, data, osDetails) {
  const sid = await sidValue(env);
  try {
    return await rpcPost(cmd, data, sid, osDetails);
  } catch (e) {
    // Retry once on SID issues
    await refreshSid(env);
    return await rpcPost(cmd, data, sharedSid, osDetails);
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

export async function listDevices(env) {
  const data = await postWithSid(env, 'GET_DEVICES', {});
  return data.devices || [];
}

export async function getStatusRaw(env, ac_id) {
  return await postWithSid(env, 'GET_LAST_TELEMETRY', { id: ac_id, commandName: 'OPER,DIAG_L2,HB' });
}

export async function getStatus(env, ac_id) {
  const d = await getStatusRaw(env, ac_id);
  return parseCommandJson(d);
}

export async function getTelemetry(env, ac_id, groups) {
  const d = await postWithSid(env, 'GET_LAST_TELEMETRY', { id: ac_id, commandName: groups });
  return parseCommandJson(d);
}

export async function refreshSidHandler(env) {
  const sid = await refreshSid(env);
  return { sid };
}

export async function sendCommand(env, ac_id, oper) {
  const payload = { id: ac_id, commandJson: JSON.stringify({ OPER: oper }) };
  return await postWithSid(env, 'SEND_COMMAND', payload);
}

export async function sendOperMerge(env, ac_id, changes) {
  const parsed = await getStatus(env, ac_id);
  const oper = (((parsed?.commandJson || {}).OPER || {}).OPER) || {};
  const newOper = { ...oper };
  if ('SPT' in changes && 'SPT' in oper) {
    const baseVal = oper.SPT;
    const chgVal = changes.SPT;
    if (Number.isInteger(baseVal) && !Number.isInteger(chgVal)) changes = { ...changes, SPT: parseInt(chgVal, 10) };
    if (typeof baseVal === 'string' && typeof chgVal !== 'string') changes = { ...changes, SPT: String(chgVal) };
  }
  Object.assign(newOper, changes);
  return await sendCommand(env, ac_id, newOper);
}