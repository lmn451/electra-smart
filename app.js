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
  pendingById: new Map(),
  optimisticById: new Map(), // key -> { desired: { isOn?, mode?, fan?, spt? }, until: epochMs }
  pendingImei: "",
  pendingPhone: "",
  resendTimerId: null,
  resendSec: 30,
  deferredPrompt: null,
  isInstalled: false,
};

const CREDS_KEY = "electraCreds";

const stepPhone = document.getElementById("stepPhone");
const controlsPanel = document.getElementById("controlsPanel");
const stepCode = document.getElementById("stepCode");
const loginPanel = document.getElementById("loginPanel");
const devicesContainer = document.getElementById("devices");
const countdown = document.getElementById("resendCountdown");
const phoneInput = document.getElementById("phoneInput");
const authStatus = document.getElementById("authStatus");
const phoneEcho = document.getElementById("phoneEcho");
const sendBtn = document.getElementById("sendOtpBtn");
const resendBtn = document.getElementById("resendBtn");

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
    navigateTo("phone");
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

// --- UI Updates --- //

function setStatusLine(text, isError = false) {
  const elStatus = document.getElementById("statusLine");
  if (elStatus) {
    elStatus.textContent = text || "";
    elStatus.classList.toggle("error", isError);
  }
}

function navigateTo(view) {
  // Hide all steps and panels initially
  if (stepPhone) stepPhone.classList.add("hidden");
  if (controlsPanel) controlsPanel.classList.add("hidden");
  if (stepCode) stepCode.classList.add("hidden");
  if (loginPanel) loginPanel.classList.add("hidden");
  if (devicesContainer) devicesContainer.classList.add("hidden");
  const toolbar = document.getElementById("toolbar");
  const phoneInput = document.getElementById("phoneInput");
  const firstOtp = document.getElementById("otp-1");

  switch (view) {
    case "phone":
      if (stepPhone) stepPhone.classList.remove("hidden");
      if (loginPanel) loginPanel.classList.remove("hidden");
      if (authStatus) authStatus.textContent = "Not signed in";
      if (phoneInput) phoneInput.focus();
      if (toolbar) toolbar.classList.add("hidden");
      break;

    case "otp":
      if (stepCode) stepCode.classList.remove("hidden");
      if (loginPanel) loginPanel.classList.remove("hidden");
      if (authStatus) authStatus.textContent = "Not signed in";
      if (firstOtp) firstOtp.focus();
      if (toolbar) toolbar.classList.add("hidden");
      break;

    case "panel":
      if (controlsPanel) controlsPanel.classList.remove("hidden");
      if (devicesContainer) devicesContainer.classList.remove("hidden");
      if (authStatus) authStatus.textContent = "Signed in";
      if (toolbar) toolbar.classList.remove("hidden");
      if (state.deviceData) {
        renderDeviceCards(state.deviceData);
      }
      break;

    default:
      console.warn(`Unknown view: ${view}`);
  }
}

function updateUIState() {
  if (state.loggedIn) {
    navigateTo("panel");
  } else {
    navigateTo("phone");
  }
}

// showStep is now obsolete and replaced by navigateTo

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
    container.innerHTML = '<div class="empty">No devices found.</div>';
    return;
  }

  const template = document.getElementById("device-card-template");

  devices.forEach((d) => {
    const id = (
      d.id ?? d.imei ?? d.device_id ?? d.name ?? "unknown"
    ).toString();
    const title = d.name ? `${d.name} — ${id}` : `Device ${id}`;

    // Clone template content
    const fragment = template.content.cloneNode(true);
    const card = fragment.firstElementChild;
    if (!card) return;
    card.dataset.id = String(id);

    // Bind static text
    const titleEl = card.querySelector('[data-bind="title"]');
    if (titleEl) titleEl.textContent = title;

    // Assign IDs used by status painting and handlers
    const badge = card.querySelector('[data-bind="badge"]');
    if (badge) badge.id = `badge-${id}`;
    const modeSpan = card.querySelector('[data-bind="mode"]');
    if (modeSpan) modeSpan.id = `mode-${id}`;
    const fanSpan = card.querySelector('[data-bind="fan"]');
    if (fanSpan) fanSpan.id = `fan-${id}`;
    const sptSpan = card.querySelector('[data-bind="spt"]');
    if (sptSpan) sptSpan.id = `spt-${id}`;
    const curSpan = card.querySelector('[data-bind="cur"]');
    if (curSpan) curSpan.id = `cur-${id}`;
    const statusInd = card.querySelector('[data-bind="status-indicator"]');
    if (statusInd) statusInd.id = `status-indicator-${id}`;

    const modeSel = card.querySelector('[data-bind="mode-select"]');
    if (modeSel) modeSel.id = `modeSel-${id}`;
    const fanSel = card.querySelector('[data-bind="fan-select"]');
    if (fanSel) fanSel.id = `fanSel-${id}`;
    const tempInput = card.querySelector('[data-bind="temp-input"]');
    if (tempInput) tempInput.id = `temp-${id}`;

    const rbtn = card.querySelector('[data-action="refresh"]');
    if (rbtn) {
      rbtn.id = `refresh-${id}`;
      rbtn.addEventListener("click", () => onRefreshDevice(id));
    }
    const pbtn = card.querySelector('[data-action="power-toggle"]');
    if (pbtn) {
      pbtn.id = `power-btn-${id}`;
      pbtn.addEventListener("click", () => onPowerToggle(id));
    }
    const incBtn = card.querySelector('[data-action="temp-inc"]');
    if (incBtn) {
      incBtn.id = `tinc-${id}`;
      incBtn.addEventListener("click", () => {
        if (state.pendingById.get(String(id))) return;
        stepTemp(id, +1);
        applyTemp(id);
      });
    }
    const decBtn = card.querySelector('[data-action="temp-dec"]');
    if (decBtn) {
      decBtn.id = `tdec-${id}`;
      decBtn.addEventListener("click", () => {
        if (state.pendingById.get(String(id))) return;
        stepTemp(id, -1);
        applyTemp(id);
      });
    }
    if (modeSel) {
      modeSel.addEventListener("change", () => onModeChange(id, modeSel.value));
    }
    if (fanSel) {
      fanSel.addEventListener("change", () => onFanChange(id, fanSel.value));
    }
    if (tempInput) {
      tempInput.addEventListener("change", () => {
        if (state.pendingById.get(String(id))) return;
        applyTemp(id);
      });
    }

    container.appendChild(card);
  });
}

async function refreshDevice(id, opts = {}) {
  try {
    const s = await apiFetch(endpoints.deviceStatus(id));
    const fields = mapStatusFields(s);
    state.statusMap.set(String(id), fields);
    paintStatus(id, fields, opts);
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
  const hasFlag = Object.hasOwn(operoper, "TURN_ON_OFF");
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

function paintStatus(id, fields, opts = {}) {
  const cur = document.getElementById(`cur-${id}`);
  if (cur) cur.textContent = fields.current ?? "—";

  const optim = state.optimisticById.get(String(id));
  const suppressControls = !!optim && !opts.forceControls;

  if (!suppressControls) {
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

    // Sync controls without triggering apply
    const modeSel = document.getElementById(`modeSel-${id}`);
    if (modeSel && fields.mode) modeSel.value = fields.mode;
    const fanSel = document.getElementById(`fanSel-${id}`);
    if (fanSel && fields.fan) {
      const optsVals = Array.from(fanSel.options).map((o) => o.value);
      fanSel.value = optsVals.includes(fields.fan) ? fields.fan : "";
    }
    const tempInput = document.getElementById(`temp-${id}`);
    if (tempInput && fields.spt != null) tempInput.value = String(fields.spt);

    // Sync power button visual state
    const pbtn = document.getElementById(`power-btn-${id}`);
    if (pbtn) {
      pbtn.classList.toggle("on", !!fields.isOn);
      pbtn.setAttribute("aria-pressed", fields.isOn ? "true" : "false");
    }
  }
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setCardStatus(id, status) {
  const indicator = document.getElementById(`status-indicator-${id}`);
  if (!indicator) return;
  indicator.className = "status-indicator";
  if (status === "updating") {
    indicator.classList.add("status-updating");
  } else if (status === "success") {
    indicator.classList.add("status-success");
    setTimeout(() => {
      if (indicator.classList.contains("status-success")) {
        indicator.classList.remove("status-success");
      }
    }, 2000);
  } else if (status === "error") {
    indicator.classList.add("status-error");
    setTimeout(() => {
      if (indicator.classList.contains("status-error")) {
        indicator.classList.remove("status-error");
      }
    }, 3000);
  }
}

function applyOptimisticUi(id, desired) {
  const key = String(id);
  setCardStatus(id, "updating");
  // Update labels
  if (desired.mode !== undefined) {
    const mlabel = document.getElementById(`mode-${key}`);
    if (mlabel) mlabel.textContent = desired.mode;
    const msel = document.getElementById(`modeSel-${key}`);
    if (msel) msel.value = desired.mode;
  }
  if (desired.fan !== undefined) {
    const flabel = document.getElementById(`fan-${key}`);
    if (flabel) flabel.textContent = desired.fan;
    const fsel = document.getElementById(`fanSel-${key}`);
    if (fsel) fsel.value = desired.fan;
  }
  if (desired.spt !== undefined) {
    const splabel = document.getElementById(`spt-${key}`);
    if (splabel) splabel.textContent = String(desired.spt);
    const tinp = document.getElementById(`temp-${key}`);
    if (tinp) tinp.value = String(desired.spt);
  }
  if (desired.isOn !== undefined) {
    const bade = document.getElementById(`badge-${key}`);
    if (bade) {
      bade.textContent = desired.isOn ? "ON" : "OFF";
      bade.classList.toggle("on", !!desired.isOn);
      bade.classList.toggle("off", !desired.isOn);
    }
    const pbtn = document.getElementById(`power-btn-${key}`);
    if (pbtn) {
      pbtn.classList.toggle("on", !!desired.isOn);
      pbtn.setAttribute("aria-pressed", desired.isOn ? "true" : "false");
    }
  }
}

function pollOptimistic(id) {
  const key = String(id);
  const entry = state.optimisticById.get(key);
  if (!entry) return;

  refreshDevice(id).then(() => {
    const currentEntry = state.optimisticById.get(key);
    if (!currentEntry) return; // already cleared

    const f = state.statusMap.get(key);
    const d = currentEntry.desired || {};
    const matched =
      (d.mode === undefined || f?.mode === d.mode) &&
      (d.fan === undefined || f?.fan === d.fan) &&
      (d.spt === undefined || f?.spt === d.spt) &&
      (d.isOn === undefined || f?.isOn === d.isOn);

    if (matched) {
      // Success: state matches desired
      state.optimisticById.delete(key);
      setCardStatus(id, "success");
      refreshDevice(id, { forceControls: true });
      return;
    }

    const now = Date.now();
    if (now >= currentEntry.until) {
      // Timeout: state still doesn't match after 3s
      state.optimisticById.delete(key);
      setCardStatus(id, "error");
      refreshDevice(id, { forceControls: true });
      return;
    }

    // Keep polling
    setTimeout(() => pollOptimistic(id), 400);
  }).catch(() => {
    const currentEntry = state.optimisticById.get(key);
    if (!currentEntry) return;
    const now = Date.now();
    if (now >= currentEntry.until) {
      state.optimisticById.delete(key);
      setCardStatus(id, "error");
      refreshDevice(id, { forceControls: true });
    } else {
      setTimeout(() => pollOptimistic(id), 400);
    }
  });
}

function startOptimistic(id, desired) {
  const key = String(id);
  const until = Date.now() + 3000; // 3s optimistic window
  const prev = state.optimisticById.get(key);
  const merged = { ...(prev?.desired || {}), ...desired };
  state.optimisticById.set(key, { desired: merged, until });
  applyOptimisticUi(id, merged);
  pollOptimistic(id);
}

function setControlsDisabled(id, disabled) {
  const ids = [
    `modeSel-${id}`,
    `fanSel-${id}`,
    `temp-${id}`,
    `tdec-${id}`,
    `tinc-${id}`,
    `power-btn-${id}`,
    `refresh-${id}`,
  ];
  ids.forEach((domId) => {
    const el = document.getElementById(domId);
    if (el) el.disabled = !!disabled;
  });
}

function onRefreshDevice(id) {
  const btn = document.getElementById(`refresh-${id}`);
  if (btn) {
    btn.disabled = true;
    btn.classList.add("spinning");
  }
  refreshDevice(id, { forceControls: true })
    .catch(() => {})
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("spinning");
      }
    });
}

function onPowerToggle(id) {
  if (state.pendingById.get(String(id))) return; // ignore re-entries or double events
  const pbtn = document.getElementById(`power-btn-${id}`);
  if (!pbtn) return;
  const currentUIOn = pbtn.classList.contains("on");
  const desired = !currentUIOn;
  // Optimistic UI: flip immediately to give instant feedback; will be reconciled on refresh
  pbtn.classList.toggle("on", desired);
  pbtn.setAttribute("aria-pressed", desired ? "true" : "false");
  return togglePower(id, desired);
}

async function directSend(id, partial) {
  const key = String(id);
  const fields = state.statusMap ? state.statusMap.get(key) : undefined;
  const isModeChange = Object.prototype.hasOwnProperty.call(
    partial || {},
    "mode"
  );
  const needsPowerOn = !!(fields && fields.isOn === false && !isModeChange);

  state.pendingById.set(String(id), true);
  setControlsDisabled(id, true);
  try {
    if (needsPowerOn) {
      await apiFetch(endpoints.power, {
        method: "POST",
        body: JSON.stringify({ ac_id: id, on: true }),
      });
      // Set default mode to DRY when powering on
      await apiFetch(endpoints.sendCommand, {
        method: "POST",
        body: JSON.stringify({ ac_id: id, mode: "DRY" }),
      });
    }

    await apiFetch(endpoints.sendCommand, {
      method: "POST",
      body: JSON.stringify({ ac_id: id, ...partial }),
    });

    // Optimistic UI for 3s, then reconcile to actual
    const desired = {};
    if (Object.prototype.hasOwnProperty.call(partial, "mode")) {
      desired.mode = partial.mode;
      if (partial.mode === "STBY") desired.isOn = false; else desired.isOn = true;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "fan")) {
      desired.fan = partial.fan;
      if (needsPowerOn) {
        desired.isOn = true;
        desired.mode = "DRY";
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, "temperature")) {
      desired.spt = partial.temperature;
      if (needsPowerOn) {
        desired.isOn = true;
        desired.mode = "DRY";
      }
    }
    startOptimistic(id, desired);
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine(`Apply error for ${id}: ${e.message}`, true);
    }
  } finally {
    state.pendingById.set(String(id), false);
    setControlsDisabled(id, false);
  }
}

function onModeChange(id, mode) {
  if (!mode) return;
  return directSend(id, { mode });
}

function onFanChange(id, fan) {
  if (!fan) return;
  return directSend(id, { fan });
}

function applyTemp(id) {
  if (state.pendingById.get(String(id))) return; // ignore while power/command in-flight
  const tempInput = document.getElementById(`temp-${id}`);
  if (!tempInput) return;
  const n = parseInt(tempInput.value, 10);
  if (!Number.isFinite(n)) return;
  const min = Number(tempInput.min || 10);
  const max = Number(tempInput.max || 35);
  const clamped = Math.min(max, Math.max(min, n));
  if (clamped !== n) tempInput.value = String(clamped);
  return directSend(id, { temperature: clamped });
}

async function togglePower(id, turnOn) {
  const powerBtn = document.getElementById(`power-btn-${id}`);
  state.pendingById.set(String(id), true);
  if (powerBtn) powerBtn.disabled = true;
  try {
    await apiFetch(endpoints.power, {
      method: "POST",
      body: JSON.stringify({ ac_id: id, on: turnOn }),
    });
    // Set default mode to DRY when powering on
    if (turnOn) {
      await apiFetch(endpoints.sendCommand, {
        method: "POST",
        body: JSON.stringify({ ac_id: id, mode: "DRY" }),
      });
    }
    setStatusLine(`Power ${turnOn ? "On" : "Off"} sent to ${id}`);
    // Optimistic UI for 3s, then reconcile to actual
    const desired = { isOn: !!turnOn };
    if (turnOn) desired.mode = "DRY";
    startOptimistic(id, desired);
  } catch (e) {
    if (e.message !== "Authentication failed") {
      setStatusLine(`Power toggle error for ${id}: ${e.message}`, true);
    }
  } finally {
    state.pendingById.set(String(id), false);
    if (powerBtn) powerBtn.disabled = false;
  }
}

// --- Auto-Refresh --- //
// Removed: no polling. Rely on one-time status fetch on mount and manual Refresh All.

// --- Initialization --- //

function initUI() {
  state.loggedIn = !!getCreds();
  updateUIState();

  const refreshBtn = document.getElementById("refresh");
  if (refreshBtn) refreshBtn.addEventListener("click", loadDevices);

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
      navigateTo("phone");
    });
  if (editPhoneLink)
    editPhoneLink.addEventListener("click", () => {
      state.pendingImei = "";
      state.pendingPhone = "";
      clearOtpInputs();
      navigateTo("phone");
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
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone
  ) {
    state.isInstalled = true;
  }

  if (!state.loggedIn) {
    navigateTo("phone");
  } else {
    loadDevices();
  }
}

async function sendOtp(isResend = false) {
  const phone = (phoneInput?.value || state.pendingPhone || "").trim();
  if (!phone) {
    if (authStatus) authStatus.textContent = "Enter phone number";
    return;
  }
  if (phoneEcho) phoneEcho.innerText = phone;
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
    navigateTo("otp");
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
