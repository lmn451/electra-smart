import { listDevices } from './_lib/electra.js';

export const onRequestGet = async ({ env }) => {
  try {
    if (!env.ELECTRA_IMEI || !env.ELECTRA_TOKEN) {
      return new Response(JSON.stringify({ error: 'server_not_configured', message: 'Set ELECTRA_IMEI and ELECTRA_TOKEN' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    const devices = await listDevices(env);
    return new Response(JSON.stringify(devices), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const body = { error: 'upstream_error', res_desc: e?.res_desc || e?.message || String(e) };
    return new Response(JSON.stringify(body), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};