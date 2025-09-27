import { getStatus } from '../_lib/electra.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

export const onRequestGet = async ({ request, params }) => {
  try {
    const ac_id = params?.ac_id;
    if (!ac_id) return new Response(JSON.stringify({ error: 'bad_request', message: 'ac_id required' }), { status: 400, headers: JSON_HEADERS });
    const imei = request.headers.get('X-Electra-IMEI');
    const token = request.headers.get('X-Electra-Token');
    if (!imei || !token) return new Response(JSON.stringify({ error: 'missing_credentials' }), { status: 401, headers: JSON_HEADERS });
    const data = await getStatus({ imei, token }, ac_id);
    return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: JSON_HEADERS });
  }
};
