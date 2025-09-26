import { getStatus, sendOperMerge } from './_lib/electra.js';

export const onRequestPost = async ({ env, request }) => {
  try {
    const body = await request.json();
    const { ac_id, on } = body || {};
    if (!ac_id || typeof on !== 'boolean') return new Response(JSON.stringify({ error: 'bad_request', message: 'ac_id and on(boolean) required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const st = await getStatus(env, ac_id);
    const cj = st?.commandJson || {};
    const operoper = (cj.OPER?.OPER) || {};
    const hasFlag = Object.prototype.hasOwnProperty.call(operoper, 'TURN_ON_OFF');
    const lastMode = operoper.AC_MODE;
    const changes = {};
    if (on) {
      if (hasFlag) {
        changes.TURN_ON_OFF = 'ON';
        if (!lastMode || lastMode === 'STBY') changes.AC_MODE = 'AUTO';
      } else {
        changes.AC_MODE = 'AUTO';
      }
    } else {
      if (hasFlag) {
        changes.TURN_ON_OFF = 'OFF';
      } else {
        changes.AC_MODE = 'STBY';
      }
    }
    const data = await sendOperMerge(env, ac_id, changes);
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};