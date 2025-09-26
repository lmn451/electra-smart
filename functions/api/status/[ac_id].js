import { getStatus } from '../_lib/electra.js';

export const onRequestGet = async ({ env, params }) => {
  try {
    const ac_id = params?.ac_id;
    if (!ac_id) return new Response(JSON.stringify({ error: 'bad_request', message: 'ac_id required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const data = await getStatus(env, ac_id);
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};