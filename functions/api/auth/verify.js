import { verifyOtp } from '../_lib/electra.js';

export const onRequestPost = async ({ request }) => {
  const JSON_HEADERS = { 'content-type': 'application/json' };
  try {
    const body = await request.json().catch(() => ({}));
    const imei = (body?.imei ?? '').toString().trim();
    const phone = (body?.phone ?? '').toString().trim();
    const code = (body?.code ?? '').toString().trim();
    if (!imei || !phone || !/^[0-9]{4,8}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'imei, phone, code required' }), { status: 400, headers: JSON_HEADERS });
    }
    const token = await verifyOtp({ imei }, phone, code);
    if (!token) {
      return new Response(JSON.stringify({ error: 'upstream_error', message: 'no token in response' }), { status: 502, headers: JSON_HEADERS });
    }
    return new Response(JSON.stringify({ imei, token }), { headers: JSON_HEADERS });
  } catch (e) {
    const status = (e && typeof e.status === 'number') ? e.status : 502;
    const body = { error: e?.error || 'upstream_error', message: e?.message, res_desc: e?.res_desc };
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
  }
};
