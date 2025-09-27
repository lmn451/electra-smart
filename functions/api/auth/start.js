import { sendOtp } from '../_lib/electra.js';

export const onRequestPost = async ({ request }) => {
  const JSON_HEADERS = { 'content-type': 'application/json' };
  try {
    const body = await request.json().catch(() => ({}));
    const phone = (body?.phone ?? '').toString().trim();
    if (!phone) return new Response(JSON.stringify({ error: 'bad_request', message: 'phone required' }), { status: 400, headers: JSON_HEADERS });

    // Allow client-provided IMEI for advanced cases, else generate one server-side
    const imeiCandidate = (body?.imei ?? body?.imeiOverride ?? '').toString().trim();
    const imei = /^2b950000\d{8}$/.test(imeiCandidate)
      ? imeiCandidate
      : `2b950000${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;

    await sendOtp({ imei }, phone);
    return new Response(JSON.stringify({ imei }), { headers: JSON_HEADERS });
  } catch (e) {
    const status = (e && typeof e.status === 'number') ? e.status : 502;
    const body = { error: e?.error || 'upstream_error', message: e?.message, res_desc: e?.res_desc };
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
  }
};
