export const endpoints = {
  listDevices: '/api/devices',
  deviceStatus: (id) => `/api/status/${encodeURIComponent(id)}`,
  sendCommand: '/api/command',
  power: '/api/power',
  authStart: '/api/auth/start',
  authVerify: '/api/auth/verify',
};

export async function apiFetch(url, options = {}) {
  const creds = getCreds();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (url.startsWith('/api/') && creds) {
    headers['X-Electra-IMEI'] = creds.imei;
    headers['X-Electra-Token'] = creds.token;
  }
  const res = await fetch(url, {
    headers,
    cache: 'no-cache',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const CREDS_KEY = 'electraCreds';
export function getCreds() {
  try { const s = sessionStorage.getItem(CREDS_KEY); if (s) return JSON.parse(s); } catch {}
  try { const l = localStorage.getItem(CREDS_KEY); if (l) return JSON.parse(l); } catch {}
  return null;
}
export function setCreds(creds, remember) {
  clearCreds();
  const json = JSON.stringify(creds);
  if (remember) localStorage.setItem(CREDS_KEY, json);
  else sessionStorage.setItem(CREDS_KEY, json);
}
export function clearCreds() {
  sessionStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(CREDS_KEY);
}
