import { h } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { apiFetch, endpoints } from '../lib/api'
import { mapStatusFields } from '../lib/status'
import { ModeSelect, FanSelect } from './Selects'

export function DeviceCard({ device, status, onRefresh, onApply, onPower }) {
  const id = String(device.id ?? device.imei ?? device.device_id ?? device.name ?? 'unknown')
  const [mode, setMode] = useState('')
  const [fan, setFan] = useState('')
  const [temp, setTemp] = useState('')

  useEffect(() => {
    if (status?.spt != null && (temp === '' || temp == null)) setTemp(String(status.spt))
  }, [status])

  const title = useMemo(() => (device.name ? `${device.name} — ${id}` : `Device ${id}`), [device, id])

  function stepTemp(delta) {
    const cur = Number(temp || 24)
    const next = Math.min(35, Math.max(10, cur + delta))
    setTemp(String(next))
  }

  return (
    <div class="card" data-id={id}>
      <div class="header">
        <div class="title">{title}</div>
        <div class={`badge ${status?.isOn ? 'on' : 'off'}`}>{status?.isOn ? 'ON' : 'OFF'}</div>
      </div>
      <div class="grid">
        <div class="kv"><span class="k">Mode</span><span>{status?.mode ?? '—'}</span></div>
        <div class="kv"><span class="k">Fan</span><span>{status?.fan ?? '—'}</span></div>
        <div class="kv"><span class="k">Setpoint</span><span>{status?.spt ?? '—'}</span></div>
        <div class="kv"><span class="k">Current</span><span>{status?.current ?? '—'}</span></div>
      </div>
      <div class="controls">
        <ModeSelect id={id} value={mode} onChange={setMode} />
        <FanSelect id={id} value={fan} onChange={setFan} />
        <div class="tempctl">
          <button class="btn" onClick={() => stepTemp(-1)}>−</button>
          <input id={`temp-${id}`} type="number" inputmode="numeric" placeholder="Temp °C" min="10" max="35" step="1" value={temp} onInput={(e) => setTemp(e.currentTarget.value)} />
          <button class="btn" onClick={() => stepTemp(+1)}>+</button>
        </div>
        <button class="btn primary" onClick={() => onApply(id, { mode, fan, temperature: temp ? Number(temp) : undefined })}>Apply</button>
        <button class="btn secondary" onClick={() => onRefresh(id)}>Refresh</button>
      </div>
      <div class="actions">
        <button class="btn" onClick={() => onPower(id, true)}>Power On</button>
        <button class="btn" onClick={() => onPower(id, false)}>Power Off</button>
      </div>
    </div>
  )
}

export function DevicesList({ devices, statusMap, setStatusLine, setStatusMap }) {
  const [loading, setLoading] = useState(false)

  async function refreshDevice(id) {
    try {
      const s = await apiFetch(endpoints.deviceStatus(id))
      const fields = mapStatusFields(s)
      setStatusMap(prev => {
        const next = new Map(prev)
        next.set(String(id), fields)
        return next
      })
    } catch (e) {
      setStatusLine(`Status error for ${id}: ${e.message}`)
    }
  }

  async function refreshAll() {
    setLoading(true)
    try {
      await Promise.all(devices.map(d => refreshDevice(d.id)))
    } finally {
      setLoading(false)
    }
  }

  async function onApply(id, body) {
    const changes = {}
    if (body.mode) changes.mode = body.mode
    if (body.fan) changes.fan = body.fan
    if (body.temperature !== undefined) changes.temperature = body.temperature
    if (!Object.keys(changes).length) { setStatusLine('Nothing to apply'); return }
    try {
      await apiFetch(endpoints.sendCommand, { method: 'POST', body: JSON.stringify({ ac_id: id, ...changes }) })
      setStatusLine(`Applied to ${id}`)
      await refreshDevice(id)
    } catch (e) {
      setStatusLine(`Apply error for ${id}: ${e.message}`)
    }
  }

  async function onPower(id, turnOn) {
    try {
      await apiFetch(endpoints.power, { method: 'POST', body: JSON.stringify({ ac_id: id, on: turnOn }) })
      setStatusLine(`Power ${turnOn ? 'On' : 'Off'} sent to ${id}`)
      await refreshDevice(id)
    } catch (e) {
      setStatusLine(`Power toggle error for ${id}: ${e.message}`)
    }
  }

  return (
    <div>
      <div class="cards">
        {devices.length === 0 && (
          <div class="empty">No devices found.</div>
        )}
        {devices.map(d => (
          <DeviceCard key={String(d.id ?? d.imei ?? d.device_id ?? d.name)} device={d} status={statusMap.get(String(d.id ?? d.imei ?? d.device_id ?? d.name))} onRefresh={refreshDevice} onApply={onApply} onPower={onPower} />
        ))}
      </div>
      <div style="display:flex; justify-content:center; padding: .5rem;">
        <button class="btn secondary" disabled={loading} onClick={refreshAll}>{loading ? 'Refreshing…' : 'Refresh All'}</button>
      </div>
    </div>
  )
}
