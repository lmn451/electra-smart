export const endpoints = {
  listDevices: "/api/devices",
  deviceStatus: (id) => `/api/status/${encodeURIComponent(id)}`,
  sendCommand: "/api/command",
  power: "/api/power",
  authStart: "/api/auth/start",
  authVerify: "/api/auth/verify",
};

const CREDS_KEY = "electraCreds";

export function getCreds() {
  try {
    const s = sessionStorage.getItem(CREDS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  try {
    const l = localStorage.getItem(CREDS_KEY);
    if (l) return JSON.parse(l);
  } catch {}
  return null;
}

export function setCreds(creds, remember) {
  clearCreds();
  const json = JSON.stringify(creds);
  if (remember) localStorage.setItem(CREDS_KEY, json);
  else sessionStorage.setItem(CREDS_KEY, json);
}

export function clearCreds() {
  try {
    sessionStorage.removeItem(CREDS_KEY);
  } catch {}
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {}
}

export async function apiFetch(url, options = {}) {
  const creds = getCreds();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (url.startsWith("/api/") && creds) {
    headers["X-Electra-IMEI"] = creds.imei;
    headers["X-Electra-Token"] = creds.token;
  }
  const res = await fetch(url, { headers, cache: "no-cache", ...options });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[API] Error response for ${url}: ${res.status} - ${text}`);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  const result = ct.includes("application/json")
    ? await res.json()
    : await res.text();
  return result;
}

// High-level API helpers
export async function startOtp(phone, imeiOverride) {
  const body = imeiOverride ? { phone, imei: imeiOverride } : { phone };
  return apiFetch(endpoints.authStart, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyOtp(imei, phone, code) {
  return apiFetch(endpoints.authVerify, {
    method: "POST",
    body: JSON.stringify({ imei, phone, code }),
  });
}

export async function fetchDevices() {
  return apiFetch(endpoints.listDevices);
}

export async function fetchStatus(id) {
  const result = await apiFetch(endpoints.deviceStatus(id));
  return result;
}

export async function applyCommand({
  ac_id,
  mode,
  fan,
  temperature,
  ac_stsrc,
  shabat,
  sleep,
  ifeel,
}) {
  const body = { ac_id };
  if (mode != null) body.mode = mode;
  if (fan != null) body.fan = fan;
  if (temperature != null) body.temperature = temperature;
  if (ac_stsrc != null) body.ac_stsrc = ac_stsrc;
  if (shabat != null) body.shabat = shabat;
  if (sleep != null) body.sleep = sleep;
  if (ifeel != null) body.ifeel = ifeel;
  const result = await apiFetch(endpoints.sendCommand, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result;
}

export async function togglePower(ac_id, on) {
  return apiFetch(endpoints.power, {
    method: "POST",
    body: JSON.stringify({ ac_id, on }),
  });
}

// Status mappers
export function mapStatusFields(s) {
  const cj = s?.commandJson || {};
  const operoper = cj?.OPER?.OPER || {};
  const diag = cj?.DIAG_L2?.DIAG_L2 || {};
  const hasFlag = Object.prototype.hasOwnProperty.call(operoper, "TURN_ON_OFF");
  const isOn = hasFlag
    ? operoper.TURN_ON_OFF !== "OFF"
    : operoper.AC_MODE !== "STBY";
  return {
    isOn,
    mode: operoper.AC_MODE ?? "STBY",
    fan: operoper.FANSPD ?? "OFF",
    spt: operoper.SPT ?? null,
    current: pickCurrentTemp(diag),
    raw: s,
  };
}

export function pickCurrentTemp(diagL2) {
  if (!diagL2) return null;
  const keys = ["I_RAT", "I_CALC_AT", "I_RCT"];
  for (const k of keys) {
    const v = diagL2[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= -5 && n <= 42) return n;
    }
  }
  return null;
}
