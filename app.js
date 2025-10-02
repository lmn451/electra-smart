const endpoints = {
  listDevices: "/api/devices",
  deviceStatus: (id) => `/api/status/${encodeURIComponent(id)}`,
  sendCommand: "/api/command",
  power: "/api/power",
  authStart: "/api/auth/start",
  authVerify: "/api/auth/verify",
};

const state = {
  loggedIn: false,
  deviceData: null,
  devices: [],
  statusMap: new Map(),
  timerId: null,
  autoSec: 60,
  autoEnabled: true,
  pendingImei: "",
  pendingPhone: "",
  resendTimerId: null,
  resendSec: 30,
  deferredPrompt: null,
  isInstalled: false,
};

const CREDS_KEY = "electraCreds";

// --- Authentication --- //

function getCreds() {
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

function setCreds(creds, remember) {
  clearCreds();
  const json = JSON.stringify(creds);
  if (remember) localStorage.setItem(CREDS_KEY, json);
  else sessionStorage.setItem(CREDS_KEY, json);
  state.loggedIn = true;
}

function clearCreds() {
  sessionStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(CREDS_KEY);
  state.loggedIn = false;
  state.deviceData = null;
}

// --- API Fetch --- //

async function apiFetch(url, options = {}) {
  const creds = getCreds();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (url.startsWith("/api/") && creds) {
    headers["X-Electra-IMEI"] = creds.imei;
    headers["X-Electra-Token"] = creds.token;
  }
  const res = await fetch(url, {
    headers,
    cache: "no-cache",
    ...options,
  });
  if (res.status === 401) {
    clearCreds();
    updateUIState();
    showStep("phone");
    setStatusLine("Authentication failed. Please sign in again.", true);
    throw new Error("Authentication failed");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// --- DOM Manipulation --- //

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "dataset")
      Object.entries(v).forEach(([dk, dv]) => (e.dataset[dk] = dv));
    else e.setAttribute(k, v);
  });
  children.forEach((c) =>
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return e;
}

// --- UI Updates --- //

function setStatusLine(text, isError = false) {
  const elStatus = document.getElementById("statusLine");
  if (elStatus) {
    elStatus.textContent = text || "";
    elStatus.classList.toggle("error", isError);
  }
}

function setAutoStatus(text) {
  const elAuto = document.getElementById("autoStatus");
  if (elAuto) elAuto.textContent = text || "";
}

function updateUIState() {
  const loginPanel = document.getElementById("loginPanel");
  const controlsPanel = document.getElementById("controlsPanel");
  if (loginPanel) loginPanel.classList.toggle("hidden", state.loggedIn);
  if (controlsPanel) controlsPanel.classList.toggle("hidden", !state.loggedIn);

  const authStatus = document.getElementById("authStatus");
  if (authStatus) {
    authStatus.textContent = state.loggedIn ? "Signed in" : "Not signed in";
  }

  if (state.loggedIn && state.deviceData) {
    renderDeviceCards(state.deviceData);
  }
}

function showStep(step) {
  const stepPhone = document.getElementById("stepPhone");
  const stepCode = document.getElementById("stepCode");
  if (!stepPhone || !stepCode) return;
  if (step === "phone") {
    stepPhone.classList.remove("hidden");
    stepCode.classList.add("hidden");
    const inp = document.getElementById("phoneInput");
    if (inp) inp.focus();
  } else {
    stepPhone.classList.add("hidden");
    stepCode.classList.remove("hidden");
    const first = document.getElementById("otp-1");
    if (first) first.focus();
  }
}

function getOtpInputs() {
  return [1, 2, 3, 4]
    .map((i) => document.getElementById(`otp-${i}`))
    .filter(Boolean);
}

function clearOtpInputs() {
  getOtpInputs().forEach((inp) => {
    inp.value = "";
  });
}

function readOtpValue() {
  return getOtpInputs()
    .map((inp) => (inp.value || "").trim())
    .join("");
}

function startResendTimer() {
  const countdown = document.getElementById("resendCountdown");
  const resendBtn = document.getElementById("resendBtn");
  let remaining = state.resendSec;
  if (resendBtn) resendBtn.disabled = true;
  if (countdown) countdown.textContent = `You can resend in ${remaining}s`;
  if (state.resendTimerId) clearInterval(state.resendTimerId);
  state.resendTimerId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(state.resendTimerId);
      state.resendTimerId = null;
      if (countdown) countdown.textContent = "";
      if (resendBtn) resendBtn.disabled = false;
    } else {
      if (countdown) countdown.textContent = `You can resend in ${remaining}s`;
    }
  }, 1000);
}

function updateAutoRefreshUI() {
  const chk = document.getElementById("autoRefreshChk");
  if (chk) chk.checked = !!state.autoEnabled;
  const running = !!state.timerId;
  if (!state.autoEnabled) {
    setAutoStatus("Auto-refresh: Off");
  } else if (!running) {
    setAutoStatus("Auto-refresh: Paused");
  } else {
    setAutoStatus(`Auto-refresh: On (${state.autoSec}s)`);
  }
}

// --- Device Logic --- //

async function loadDevices() {
  const loadingEl = document.getElementById("controlsLoading");
  const container = document.getElementById("devices");
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (container) container.innerHTML = "";
  if (!getCreds()) {
    setStatusLine("Sign in to view devices", true);
    if (loadingEl) loadingEl.classList.add("hidden");
    return;
  }
  setStatusLine("Loading devices…");
  try {
    const devices = await apiFetch(endpoints.listDevices);
    state.deviceData = Array.isArray(devices) ? devices : devices.devices || [];
    state.devices = state.deviceData;
    if (state.deviceData.length === 0) {
      console.warn("No devices found");
    } else if (state.deviceData.length > 1) {
      console.warn(
        `Multiple devices found: ${state.deviceData.length}. Rendering all.`
      );
    }
    renderDeviceCards(state.devices);
    await Promise.all(state.devices.map((d) => refreshDevice(d.id)));
    setStatusLine("");

    // Show install button if available
    showInstallButton();
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine("Failed to load devices", true);
      if (container)
        container.innerHTML = `<div class="empty">Failed to load devices: ${e.message}</div>`;
    }
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

function renderDeviceCards(devices) {
  const container = document.getElementById("devices");
  container.classList.add("cards");
  container.innerHTML = "";
  if (!devices.length) {
    container.appendChild(
      el("div", { class: "empty", text: "No devices found." })
    );
    return;
  }
  devices.forEach((d) => {
    const id = (
      d.id ??
      d.imei ??
      d.device_id ??
      d.name ??
      "unknown"
    ).toString();
    const title = d.name ? `${d.name} — ${id}` : `Device ${id}`;
    const card = el(
      "div",
      { class: "card", dataset: { id: String(id) } },
      el(
        "div",
        { class: "header" },
        el("div", { class: "title", text: title }),
        el("div", { class: "badge", id: `badge-${id}` }, "—")
      ),
      el(
        "div",
        { class: "grid" },
        el(
          "div",
          { class: "kv" },
          el("span", { class: "k", text: "Mode" }),
          el("span", { id: `mode-${id}`, text: "—" })
        ),
        el(
          "div",
          { class: "kv" },
          el("span", { class: "k", text: "Fan" }),
          el("span", { id: `fan-${id}`, text: "—" })
        ),
        el(
          "div",
          { class: "kv" },
          el("span", { class: "k", text: "Setpoint" }),
          el("span", { id: `spt-${id}`, text: "—" })
        ),
        el(
          "div",
          { class: "kv" },
          el("span", { class: "k", text: "Current" }),
          el("span", { id: `cur-${id}`, text: "—" })
        )
      ),
      el(
        "div",
        { class: "controls" },
        buildModeSelect(id),
        buildFanSelect(id),
        buildTempControl(id),
        el("button", { id: `apply-${id}`, class: "btn primary" }, "Apply"),
        el("button", { id: `refresh-${id}`, class: "btn secondary" }, "Refresh")
      ),
      el(
        "div",
        { class: "actions" },
        el("button", { id: `power-on-${id}`, class: "btn" }, "Power On"),
        el("button", { id: `power-off-${id}`, class: "btn" }, "Power Off")
      )
    );
    container.appendChild(card);

    document.getElementById(`refresh-${id}`).onclick = () => refreshDevice(id);
    document.getElementById(`apply-${id}`).onclick = () => applyChanges(id);
    document.getElementById(`power-on-${id}`).onclick = () =>
      togglePower(id, true);
    document.getElementById(`power-off-${id}`).onclick = () =>
      togglePower(id, false);
    const dec = document.getElementById(`tdec-${id}`);
    const inc = document.getElementById(`tinc-${id}`);
    if (dec) dec.onclick = () => stepTemp(id, -1);
    if (inc) inc.onclick = () => stepTemp(id, +1);
  });
}

function buildModeSelect(id) {
  const sel = el(
    "select",
    { id: `modeSel-${id}` },
    el("option", { value: "", text: "Mode…" }),
    el("option", { value: "STBY", text: "STBY (Standby)" }),
    el("option", { value: "COOL", text: "COOL" }),
    el("option", { value: "FAN", text: "FAN" }),
    el("option", { value: "DRY", text: "DRY" }),
    el("option", { value: "HEAT", text: "HEAT" }),
    el("option", { value: "AUTO", text: "AUTO" })
  );
  return sel;
}

function buildFanSelect(id) {
  const sel = el(
    "select",
    { id: `fanSel-${id}` },
    el("option", { value: "", text: "Fan…" }),
    el("option", { value: "LOW", text: "LOW" }),
    el("option", { value: "MED", text: "MED" }),
    el("option", { value: "HIGH", text: "HIGH" }),
    el("option", { value: "AUTO", text: "AUTO" })
  );
  return sel;
}

function buildTempControl(id) {
  const wrap = el(
    "div",
    { class: "tempctl" },
    el("button", { id: `tdec-${id}`, class: "btn" }, "−"),
    el("input", {
      id: `temp-${id}`,
      type: "number",
      inputmode: "numeric",
      placeholder: "Temp °C",
      min: "10",
      max: "35",
      step: "1",
    }),
    el("button", { id: `tinc-${id}`, class: "btn" }, "+")
  );
  return wrap;
}

async function refreshDevice(id) {
  try {
    const s = await apiFetch(endpoints.deviceStatus(id));
    const fields = mapStatusFields(s);
    state.statusMap.set(String(id), fields);
    paintStatus(id, fields);
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine(`Status error for ${id}: ${e.message}`, true);
    }
  }
}

function mapStatusFields(s) {
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

function pickCurrentTemp(diagL2) {
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

function paintStatus(id, fields) {
  const bade = document.getElementById(`badge-${id}`);
  if (bade) {
    bade.textContent = fields.isOn ? "ON" : "OFF";
    bade.classList.toggle("on", fields.isOn);
    bade.classList.toggle("off", !fields.isOn);
  }
  const m = document.getElementById(`mode-${id}`);
  if (m) m.textContent = fields.mode ?? "—";
  const f = document.getElementById(`fan-${id}`);
  if (f) f.textContent = fields.fan ?? "—";
  const sp = document.getElementById(`spt-${id}`);
  if (sp) sp.textContent = fields.spt ?? "—";
  const cur = document.getElementById(`cur-${id}`);
  if (cur) cur.textContent = fields.current ?? "—";
  const tempInput = document.getElementById(`temp-${id}`);
  if (tempInput && !tempInput.value && fields.spt != null)
    tempInput.value = String(fields.spt);
}

function stepTemp(id, delta) {
  const input = document.getElementById(`temp-${id}`);
  if (!input) return;
  const min = Number(input.min || 10);
  const max = Number(input.max || 35);
  const cur = Number(input.value || 24);
  const next = Math.min(max, Math.max(min, cur + delta));
  input.value = String(next);
}

async function applyChanges(id) {
  const modeSel = document.getElementById(`modeSel-${id}`);
  const fanSel = document.getElementById(`fanSel-${id}`);
  const tempInput = document.getElementById(`temp-${id}`);
  const body = { ac_id: id };
  if (modeSel && modeSel.value) body.mode = modeSel.value;
  if (fanSel && fanSel.value) body.fan = fanSel.value;
  if (tempInput && tempInput.value) body.temperature = Number(tempInput.value);
  if (!body.mode && !body.fan && body.temperature === undefined) {
    setStatusLine("Nothing to apply");
    return;
  }
  const applyBtn = document.getElementById(`apply-${id}`);
  if (applyBtn) applyBtn.disabled = true;
  try {
    await apiFetch(endpoints.sendCommand, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setStatusLine(`Applied to ${id}`);
    await refreshDevice(id);
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine(`Apply error for ${id}: ${e.message}`, true);
    }
  } finally {
    if (applyBtn) applyBtn.disabled = false;
  }
}

async function togglePower(id, turnOn) {
  const powerBtn = document.getElementById(
    `power-${turnOn ? "on" : "off"}-${id}`
  );
  if (powerBtn) powerBtn.disabled = true;
  try {
    await apiFetch(endpoints.power, {
      method: "POST",
      body: JSON.stringify({ ac_id: id, on: turnOn }),
    });
    setStatusLine(`Power ${turnOn ? "On" : "Off"} sent to ${id}`);
    await refreshDevice(id);
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine(`Power toggle error for ${id}: ${e.message}`, true);
    }
  } finally {
    if (powerBtn) powerBtn.disabled = false;
  }
}

// --- Auto-Refresh --- //

function applyAutoRefresh(enabled) {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  state.autoEnabled = !!enabled;
  if (state.autoEnabled) {
    state.timerId = setInterval(() => {
      state.devices.forEach((d) => refreshDevice(d.id));
    }, state.autoSec * 1000);
  }
  updateAutoRefreshUI();
}

// --- Initialization --- //

function initUI() {
  state.loggedIn = !!getCreds();
  updateUIState();

  const refreshBtn = document.getElementById("refresh");
  if (refreshBtn) refreshBtn.addEventListener("click", loadDevices);

  const chk = document.getElementById("autoRefreshChk");
  if (chk) {
    chk.addEventListener("change", () => applyAutoRefresh(chk.checked));
    applyAutoRefresh(chk.checked);
  }

  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const verifyBtn = document.getElementById("verifyBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const editPhoneLink = document.getElementById("editPhoneLink");
  const resendBtn = document.getElementById("resendBtn");
  if (sendOtpBtn) sendOtpBtn.addEventListener("click", () => sendOtp(false));
  if (resendBtn) resendBtn.addEventListener("click", () => sendOtp(true));
  if (verifyBtn) verifyBtn.addEventListener("click", verifyOtp);
  if (logoutBtn)
    logoutBtn.addEventListener("click", () => {
      clearCreds();
      updateUIState();
      setStatusLine("Signed out");
      showStep("phone");
    });
  if (editPhoneLink)
    editPhoneLink.addEventListener("click", () => {
      state.pendingImei = "";
      state.pendingPhone = "";
      clearOtpInputs();
      showStep("phone");
    });

  const inputs = getOtpInputs();
  inputs.forEach((inp, idx) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
      if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      if (e.key === "ArrowLeft" && idx > 0) inputs[idx - 1].focus();
      if (e.key === "ArrowRight" && idx < inputs.length - 1)
        inputs[idx + 1].focus();
    });
    inp.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (text && /\d{4,6}/.test(text)) {
        e.preventDefault();
        const digits = text.replace(/\D/g, "").slice(0, 6).split("");
        inputs.forEach((el, i) => {
          el.value = digits[i] || "";
        });
        (inputs[digits.length - 1] || inputs[inputs.length - 1]).focus();
      }
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
      updateAutoRefreshUI();
    } else if (state.autoEnabled) {
      applyAutoRefresh(true);
    }
  });

  window.addEventListener("offline", () =>
    setStatusLine("You are offline", true)
  );
  window.addEventListener("online", () => setStatusLine(""));

  // PWA Install Prompt Handling
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    state.isInstalled = true;
    state.deferredPrompt = null;
    hideInstallButton();
    setStatusLine("App installed successfully!", false);
    setTimeout(() => setStatusLine(""), 3000);
  });

  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    state.isInstalled = true;
  }

  if (!state.loggedIn) {
    showStep("phone");
  } else {
    loadDevices();
  }
}

async function sendOtp(isResend = false) {
  const phoneInput = document.getElementById("phoneInput");
  const authStatus = document.getElementById("authStatus");
  const phoneEcho = document.getElementById("phoneEcho");
  const sendBtn = document.getElementById("sendOtpBtn");
  const resendBtn = document.getElementById("resendBtn");
  const phone = (phoneInput?.value || state.pendingPhone || "").trim();
  if (!phone) {
    if (authStatus) authStatus.textContent = "Enter phone number";
    return;
  }
  if (sendBtn) sendBtn.disabled = true;
  if (resendBtn) resendBtn.disabled = true;
  try {
    const payload =
      isResend && state.pendingImei
        ? { phone, imei: state.pendingImei }
        : { phone };
    const res = await apiFetch(endpoints.authStart, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const imei = res?.imei;
    if (!imei) throw new Error("No IMEI returned");
    state.pendingImei = imei;
    state.pendingPhone = phone;
    if (authStatus) authStatus.textContent = "Code sent";
    if (phoneEcho) phoneEcho.textContent = phone;
    clearOtpInputs();
    showStep("code");
    startResendTimer();
  } catch (e) {
    if (authStatus) authStatus.textContent = `Send failed: ${e.message}`;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function verifyOtp() {
  const rememberChk = document.getElementById("rememberChk");
  const authStatus = document.getElementById("authStatus");
  const phone = state.pendingPhone;
  const code = readOtpValue();
  const imei = state.pendingImei;
  if (!phone || !code || !imei) {
    if (authStatus) authStatus.textContent = "Enter phone and full code";
    return;
  }
  const verifyBtn = document.getElementById("verifyBtn");
  if (verifyBtn) verifyBtn.disabled = true;
  try {
    const res = await apiFetch(endpoints.authVerify, {
      method: "POST",
      body: JSON.stringify({ imei, phone, code }),
    });
    const token = res?.token;
    if (!token) throw new Error("No token");
    setCreds({ imei, token }, !!rememberChk?.checked);
    state.loggedIn = true;
    updateUIState();
    if (authStatus) authStatus.textContent = "Signed in";
    await loadDevices();
  } catch (e) {
    if (authStatus) authStatus.textContent = `Verify failed: ${e.message}`;
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
  }
}

// PWA Install Functions
function showInstallButton() {
  let installBtn = document.getElementById("installBtn");
  if (!installBtn && !state.isInstalled) {
    const toolbar = document.getElementById("toolbar");
    if (toolbar && !toolbar.classList.contains("hidden")) {
      installBtn = document.createElement("button");
      installBtn.id = "installBtn";
      installBtn.innerHTML = "📱 Install App";
      installBtn.className = "btn primary";
      installBtn.style.fontSize = "0.9rem";
      installBtn.addEventListener("click", installApp);
      toolbar.appendChild(installBtn);
    }
  }
}

function hideInstallButton() {
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.remove();
  }
}

async function installApp() {
  if (!state.deferredPrompt) return;

  try {
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setStatusLine("Installing app...", false);
    } else {
      setStatusLine("App installation cancelled", true);
      setTimeout(() => setStatusLine(""), 3000);
    }

    state.deferredPrompt = null;
    hideInstallButton();
  } catch (error) {
    console.error("Installation failed:", error);
    setStatusLine("Installation failed", true);
    setTimeout(() => setStatusLine(""), 3000);
  }
}

// Enhanced offline handling
function handleOfflineUI() {
  const devices = document.getElementById("devices");
  if (devices && !navigator.onLine) {
    devices.innerHTML = `
      <div class="empty">
        <div style="font-size: 2rem; margin-bottom: 1rem;">📶</div>
        <p>You're currently offline</p>
        <p class="muted">Device controls require an internet connection</p>
        <button class="btn primary" onclick="window.location.reload()" style="margin-top: 1rem;">
          Try Again
        </button>
      </div>
    `;
  }
}

window.addEventListener("DOMContentLoaded", initUI);
