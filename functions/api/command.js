import { sendOperMerge } from './_lib/electra.js';

export const onRequestPost = async ({ env, request }) => {
  try {
    const body = await request.json();
    const { ac_id, mode, fan, temperature, ac_stsrc, shabat, sleep, ifeel } = body || {};
    if (!ac_id) return new Response(JSON.stringify({ error: 'bad_request', message: 'ac_id required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const changes = {};
    if (mode != null) changes.AC_MODE = mode;
    if (fan != null) changes.FANSPD = fan;
    if (temperature != null) changes.SPT = temperature;
    if (ac_stsrc != null) changes.AC_STSRC = ac_stsrc;
    if (shabat != null) changes.SHABAT = shabat;
    if (sleep != null) changes.SLEEP = sleep;
    if (ifeel != null) changes.IFEEL = ifeel;
    if (Object.keys(changes).length === 0) return new Response(JSON.stringify({ error: 'no_change' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const data = await sendOperMerge(env, ac_id, changes);
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};