# Refactoring Options for Scalable DOM Building

## Current Problem
The `el()` helper creates verbose, deeply nested code that's hard to read and maintain:
```js
el("div", { class: "card" },
  el("div", { class: "header" },
    el("div", { class: "title" }, "...")
  )
)
```

## Option 1: HTML Templates (No Dependencies) ⭐ Recommended

### Pros
- Zero dependencies
- Fast (native DOM cloning)
- Works with existing vanilla JS
- Easy migration path

### Cons
- Still need to wire up event listeners separately
- Template is in index.html (could also be in JS as template literal)

### Implementation

**1. Add template to index.html:**
```html
<template id="device-card-template">
  <div class="card">
    <div class="header">
      <div class="title" data-bind="title"></div>
      <div class="header-right">
        <div class="badge" data-bind="badge">—</div>
        <button class="icon-btn" data-action="refresh" title="Refresh device" aria-label="Refresh device">↻</button>
      </div>
    </div>
    
    <div class="grid">
      <div class="kv">
        <span class="k">Mode</span>
        <span data-bind="mode">—</span>
      </div>
      <div class="kv">
        <span class="k">Fan</span>
        <span data-bind="fan">—</span>
      </div>
      <div class="kv">
        <span class="k">Setpoint</span>
        <span data-bind="spt">—</span>
      </div>
      <div class="kv">
        <span class="k">Current</span>
        <span data-bind="cur">—</span>
      </div>
    </div>
    
    <div class="controls controls-erg">
      <div class="controls-left">
        <select data-bind="mode-select">
          <option value="">Mode…</option>
          <option value="STBY">STBY (Standby)</option>
          <option value="COOL">COOL</option>
          <option value="FAN">FAN</option>
          <option value="DRY" selected>DRY</option>
          <option value="HEAT">HEAT</option>
          <option value="AUTO">AUTO</option>
        </select>
        
        <select data-bind="fan-select">
          <option value="">Fan…</option>
          <option value="LOW" selected>LOW</option>
          <option value="MED">MED</option>
          <option value="HIGH">HIGH</option>
          <option value="AUTO">AUTO</option>
        </select>
      </div>
      
      <div class="controls-right tempctl-erg">
        <input type="number" data-bind="temp-input" inputmode="numeric" placeholder="Temp °C" min="10" max="35" step="1" />
        <div class="temp-vert">
          <button class="btn temp-inc" data-action="temp-inc">+</button>
          <button class="btn temp-dec" data-action="temp-dec">−</button>
        </div>
        <button class="btn power-btn power-under" data-action="power-toggle" aria-pressed="false" aria-label="Power">⏻</button>
      </div>
    </div>
    
    <div class="status-indicator" data-bind="status-indicator"></div>
  </div>
</template>
```

**2. Refactor app.js:**
```js
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
    const id = String(d.id ?? d.imei ?? d.device_id ?? d.name ?? "unknown");
    const title = d.name ? `${d.name} — ${id}` : `Device ${id}`;
    
    // Clone template
    const card = template.content.cloneNode(true).firstElementChild;
    card.dataset.id = id;
    
    // Bind data
    card.querySelector('[data-bind="title"]').textContent = title;
    
    // Add IDs for status updates
    card.querySelector('[data-bind="badge"]').id = `badge-${id}`;
    card.querySelector('[data-bind="mode"]').id = `mode-${id}`;
    card.querySelector('[data-bind="fan"]').id = `fan-${id}`;
    card.querySelector('[data-bind="spt"]').id = `spt-${id}`;
    card.querySelector('[data-bind="cur"]').id = `cur-${id}`;
    card.querySelector('[data-bind="status-indicator"]').id = `status-indicator-${id}`;
    
    const modeSelect = card.querySelector('[data-bind="mode-select"]');
    modeSelect.id = `modeSel-${id}`;
    
    const fanSelect = card.querySelector('[data-bind="fan-select"]');
    fanSelect.id = `fanSel-${id}`;
    
    const tempInput = card.querySelector('[data-bind="temp-input"]');
    tempInput.id = `temp-${id}`;
    
    // Wire up event listeners using event delegation or direct
    const refreshBtn = card.querySelector('[data-action="refresh"]');
    refreshBtn.id = `refresh-${id}`;
    refreshBtn.addEventListener("click", () => onRefreshDevice(id));
    
    const powerBtn = card.querySelector('[data-action="power-toggle"]');
    powerBtn.id = `power-btn-${id}`;
    powerBtn.addEventListener("click", () => onPowerToggle(id));
    
    const incBtn = card.querySelector('[data-action="temp-inc"]');
    incBtn.id = `tinc-${id}`;
    incBtn.addEventListener("click", () => {
      if (state.pendingById.get(id)) return;
      stepTemp(id, 1);
      applyTemp(id);
    });
    
    const decBtn = card.querySelector('[data-action="temp-dec"]');
    decBtn.id = `tdec-${id}`;
    decBtn.addEventListener("click", () => {
      if (state.pendingById.get(id)) return;
      stepTemp(id, -1);
      applyTemp(id);
    });
    
    modeSelect.addEventListener("change", () => onModeChange(id, modeSelect.value));
    fanSelect.addEventListener("change", () => onFanChange(id, fanSelect.value));
    tempInput.addEventListener("change", () => {
      if (state.pendingById.get(id)) return;
      applyTemp(id);
    });
    
    container.appendChild(card);
  });
}
```

---

## Option 2: htm + Preact (Modern, Lightweight)

### Pros
- JSX-like syntax without build step
- Component-based architecture
- Reactive updates
- Only ~4KB total

### Cons
- New dependency
- Requires learning component patterns
- More refactoring needed

### Implementation

**1. Install:**
```bash
pnpm add htm preact
```

**2. Add to index.html:**
```html
<script type="module" src="./app-components.js"></script>
```

**3. Create app-components.js:**
```js
import { html, render, Component } from 'https://cdn.skypack.dev/htm/preact/standalone';

class DeviceCard extends Component {
  state = { pending: false };
  
  render({ device, onRefresh, onModeChange, onFanChange, onPowerToggle, onTempChange }) {
    const id = device.id;
    const title = device.name ? `${device.name} — ${id}` : `Device ${id}`;
    
    return html`
      <div class="card" data-id=${id}>
        <div class="header">
          <div class="title">${title}</div>
          <div class="header-right">
            <div class="badge" id="badge-${id}">—</div>
            <button 
              class="icon-btn" 
              onClick=${() => onRefresh(id)}
              disabled=${this.state.pending}
            >↻</button>
          </div>
        </div>
        
        <div class="grid">
          <div class="kv">
            <span class="k">Mode</span>
            <span id="mode-${id}">—</span>
          </div>
          <div class="kv">
            <span class="k">Fan</span>
            <span id="fan-${id}">—</span>
          </div>
          <div class="kv">
            <span class="k">Setpoint</span>
            <span id="spt-${id}">—</span>
          </div>
          <div class="kv">
            <span class="k">Current</span>
            <span id="cur-${id}">—</span>
          </div>
        </div>
        
        <div class="controls controls-erg">
          <div class="controls-left">
            <select 
              id="modeSel-${id}"
              onChange=${(e) => onModeChange(id, e.target.value)}
            >
              <option value="">Mode…</option>
              <option value="STBY">STBY (Standby)</option>
              <option value="COOL">COOL</option>
              <option value="FAN">FAN</option>
              <option value="DRY" selected>DRY</option>
              <option value="HEAT">HEAT</option>
              <option value="AUTO">AUTO</option>
            </select>
            
            <select 
              id="fanSel-${id}"
              onChange=${(e) => onFanChange(id, e.target.value)}
            >
              <option value="">Fan…</option>
              <option value="LOW" selected>LOW</option>
              <option value="MED">MED</option>
              <option value="HIGH">HIGH</option>
              <option value="AUTO">AUTO</option>
            </select>
          </div>
          
          <div class="controls-right tempctl-erg">
            <input 
              type="number" 
              id="temp-${id}"
              onChange=${() => onTempChange(id)}
              min="10" 
              max="35" 
              step="1"
            />
            <div class="temp-vert">
              <button 
                class="btn temp-inc"
                onClick=${() => this.handleTempStep(id, 1)}
              >+</button>
              <button 
                class="btn temp-dec"
                onClick=${() => this.handleTempStep(id, -1)}
              >−</button>
            </div>
            <button 
              class="btn power-btn power-under"
              onClick=${() => onPowerToggle(id)}
            >⏻</button>
          </div>
        </div>
        
        <div class="status-indicator" id="status-indicator-${id}"></div>
      </div>
    `;
  }
  
  handleTempStep(id, delta) {
    if (state.pendingById.get(id)) return;
    stepTemp(id, delta);
    applyTemp(id);
  }
}

// Render
function renderDevices(devices) {
  render(
    html`
      <div class="cards">
        ${devices.map(d => html`
          <${DeviceCard} 
            device=${d}
            onRefresh=${onRefreshDevice}
            onModeChange=${onModeChange}
            onFanChange=${onFanChange}
            onPowerToggle=${onPowerToggle}
            onTempChange=${applyTemp}
          />
        `)}
      </div>
    `,
    document.getElementById('devices')
  );
}
```

---

## Recommendation

**Go with Option 1 (HTML Templates)** because:
1. Zero dependencies
2. Minimal refactoring (mostly just moving HTML)
3. Works with your existing vanilla JS architecture
4. Easy to understand and maintain
5. Fast performance (native DOM cloning)

Would you like me to implement Option 1 for you?
