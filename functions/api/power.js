import { getStatus, sendOperMerge } from './_lib/electra.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

export const onRequestPost = async ({ request }) => {
  try {
    const imei = request.headers.get('X-Electra-IMEI');
    const token = request.headers.get('X-Electra-Token');
    if (!imei || !token) return new Response(JSON.stringify({ error: 'missing_credentials' }), { status: 401, headers: JSON_HEADERS });
    const body = await request.json();
    const { ac_id, on } = body || {};
    if (!ac_id || typeof on !== 'boolean') return new Response(JSON.stringify({ error: 'bad_request', message: 'ac_id and on(boolean) required' }), { status: 400, headers: JSON_HEADERS });
    const st = await getStatus({ imei, token }, ac_id);
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
    const data = await sendOperMerge({ imei, token }, ac_id, changes);
    return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: JSON_HEADERS });
  }
};
