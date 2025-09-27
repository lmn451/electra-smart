<script>
  import { statusMap, statusLine } from '../stores.js'
  import { fetchStatus, applyCommand, togglePower, mapStatusFields } from '../lib/api.js'
  export let d

  $: id = (d?.id ?? d?.imei ?? d?.device_id ?? d?.name ?? 'unknown').toString()
  $: title = d?.name ? `${d.name} — ${id}` : `Device ${id}`
  $: fields = $statusMap.get(id)

  async function refresh() {
    try {
      const s = await fetchStatus(id)
      const f = mapStatusFields(s)
      statusMap.update(m => new Map(m.set(String(id), f)))
    } catch (e) {
      statusLine.set(`Status error for ${id}: ${e.message}`)
    }
  }

  let mode='', fan='', temp=''

  let working = false

  async function apply() {
    const body = { ac_id: id }
    if (mode) body.mode = mode
    if (fan) body.fan = fan
    if (temp) body.temperature = Number(temp)
    if (!body.mode && !body.fan && body.temperature === undefined) {
      statusLine.set('Nothing to apply');
      return
    }
    try {
      working = true
      await applyCommand(body)
      statusLine.set(`Applied to ${id}`)
      await refresh()
    } catch (e) {
      statusLine.set(`Apply error for ${id}: ${e.message}`)
    } finally {
      working = false
    }
  }

  async function power(on) {
    try {
      working = true
      await togglePower(id, on)
      statusLine.set(`Power ${on ? 'On' : 'Off'} sent to ${id}`)
      await refresh()
    } catch (e) {
      statusLine.set(`Power toggle error for ${id}: ${e.message}`)
    } finally {
      working = false
    }
  }
</script>

<div class="card" data-id={id}>
  <div class="header">
    <div class="title">{title}</div>
    <div class="badge {fields?.isOn ? 'on' : 'off'}">{fields ? (fields.isOn ? 'ON' : 'OFF') : '—'}</div>
  </div>
  <div class="grid">
    <div class="kv"><span class="k">Mode</span><span id={`mode-${id}`}>{fields?.mode ?? '—'}</span></div>
    <div class="kv"><span class="k">Fan</span><span id={`fan-${id}`}>{fields?.fan ?? '—'}</span></div>
    <div class="kv"><span class="k">Setpoint</span><span id={`spt-${id}`}>{fields?.spt ?? '—'}</span></div>
    <div class="kv"><span class="k">Current</span><span id={`cur-${id}`}>{fields?.current ?? '—'}</span></div>
  </div>
  <div class="controls">
    <label class="visually-hidden" for={`modeSel-${id}`}>Mode</label>
    <select id={`modeSel-${id}`} bind:value={mode} aria-label="Mode">
      <option value="">Mode…</option>
      <option value="STBY">STBY (Standby)</option>
      <option value="COOL">COOL</option>
      <option value="FAN">FAN</option>
      <option value="DRY">DRY</option>
      <option value="HEAT">HEAT</option>
      <option value="AUTO">AUTO</option>
    </select>

    <label class="visually-hidden" for={`fanSel-${id}`}>Fan speed</label>
    <select id={`fanSel-${id}`} bind:value={fan} aria-label="Fan speed">
      <option value="">Fan…</option>
      <option value="LOW">LOW</option>
      <option value="MED">MED</option>
      <option value="HIGH">HIGH</option>
      <option value="AUTO">AUTO</option>
    </select>

    <div class="tempctl">
      <button class="btn" on:click={() => temp = String(Math.max(10, Number(temp||24) - 1))} aria-label="Decrease setpoint">−</button>
      <input type="number" bind:value={temp} min="10" max="35" step="1" placeholder="Temp °C" aria-label="Setpoint temperature in Celsius" />
      <button class="btn" on:click={() => temp = String(Math.min(35, Number(temp||24) + 1))} aria-label="Increase setpoint">+</button>
    </div>

    <button class="btn primary" on:click={apply} disabled={working}> {working ? 'Applying…' : 'Apply'} </button>
    <button class="btn secondary" on:click={refresh} disabled={working}>Refresh</button>
  </div>
  <div class="actions">
    <button class="btn" on:click={() => power(true)} disabled={working}>Power On</button>
    <button class="btn" on:click={() => power(false)} disabled={working}>Power Off</button>
  </div>
</div>
