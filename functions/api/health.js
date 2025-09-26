export const onRequestGet = async ({ env }) => {
  const hasSecrets = Boolean(env.ELECTRA_IMEI && env.ELECTRA_TOKEN);
  return new Response(JSON.stringify({ status: 'ok', has_secrets: hasSecrets, allow_auth_endpoints: false }), {
    headers: { 'content-type': 'application/json' }
  });
};