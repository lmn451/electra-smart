import { h } from 'preact'
import { useMemo } from 'preact/hooks'
import { apiFetch, endpoints } from '../lib/api'
import { mapStatusFields } from '../lib/status'
import { ModeSelect, FanSelect } from './Selects'

function PowerToggle({ id, isOn, onToggle }) {
  return (
    <label for={`power-${id}`} class="power-toggle">
      <input id={`power-${id}`} class="visually-hidden" type="checkbox" checked={isOn} onChange={e => onToggle(e.currentTarget.checked)} />
      <div class="switch">
        <div class="dot" />
      </div>
      <span class="label">{isOn ? 'On' : 'Off'}</span>
    </label>
  )
}

export function DeviceCard({ device, status, onControlChange, onPower }) {
  const id = String(device.id ?? device.imei ?? device.device_id ?? 'unknown')
  const title = useMemo(() => (device.name ? `${device.name} — ${id}` : `Device ${id}`), [device, id])
  const temp = status?.spt ?? ''

  function stepTemp(delta) {
    const cur = Number(temp || 24)
    const next = Math.min(35, Math.max(10, cur + delta))
    onControlChange(id, { temperature: next })
  }

  function handleTempInput(e) {
    const next = e.currentTarget.value
    onControlChange(id, { temperature: next === '' ? undefined : Number(next) })
  }

  return (
    <div class="card" data-id={id} data-on={status?.isOn}>
      <div class="header">
        <div class="title">{title}</div>
        <PowerToggle id={id} isOn={status?.isOn} onToggle={on => onPower(id, on)} />
      </div>
      <div class="grid">
        <div class="kv"><span class="k">Mode</span><span>{status?.mode ?? '—'}</span></div>
        <div class="kv"><span class="k">Fan</span><span>{status?.fan ?? '—'}</span></div>
        <div class="kv"><span class="k">Setpoint</span><span>{status?.spt ?? '—'}</span></div>
        <div class="kv"><span class="k">Current</span><span>{status?.current ?? '—'}</span></div>
      </div>
      <div class="controls">
        <ModeSelect id={id} value={status?.mode} onChange={mode => onControlChange(id, { mode })} />
        <FanSelect id={id} value={status?.fan} onChange={fan => onControlChange(id, { fan })} />
        <div class="tempctl">
          <button class="btn" onClick={() => stepTemp(-1)} disabled={!status?.isOn}>−</button>
          <input
            id={`temp-${id}`}
            type="number"
            inputmode="numeric"
            placeholder="°C"
            min="10"
            max="35"
            step="1"
            value={temp}
            onInput={handleTempInput}
            disabled={!status?.isOn}
          />
          <button class="btn" onClick={() => stepTemp(+1)} disabled={!status?.isOn}>+</button>
        </div>
      </div>
    </div>
  )
}

export function DevicesList({ devices, statusMap, setStatusLine, setStatusMap }) {
  async function refreshDevice(id) {
    try {
      const s = await apiFetch(endpoints.deviceStatus(id))
      const fields = mapStatusFields(s)
      setStatusMap(prev => new Map(prev).set(String(id), fields))
    } catch (e) {
      setStatusLine(`Status error for ${id}: ${e.message}`)
    }
  }

  async function onControlChange(id, changes) {
    const originalStatus = statusMap.get(String(id))
    const optimisticStatus = { ...originalStatus, ...mapStatusFields(changes) }
    setStatusMap(prev => new Map(prev).set(String(id), optimisticStatus))

    try {
      await apiFetch(endpoints.sendCommand, { method: 'POST', body: JSON.stringify({ ac_id: id, ...changes }) })
      await refreshDevice(id)
    } catch (e) {
      setStatusLine(`Command failed for ${id}: ${e.message}`)
      if (originalStatus) {
        setStatusMap(prev => new Map(prev).set(String(id), originalStatus))
      }
    }
  }

  async function onPower(id, turnOn) {
    const originalStatus = statusMap.get(String(id))
    const optimisticStatus = { ...originalStatus, isOn: turnOn }
    setStatusMap(prev => new Map(prev).set(String(id), optimisticStatus))

    try {
      await apiFetch(endpoints.power, { method: 'POST', body: JSON.stringify({ ac_id: id, on: turnOn }) })
      await refreshDevice(id)
    } catch (e) {
      setStatusLine(`Power toggle failed for ${id}: ${e.message}`)
      if (originalStatus) {
        setStatusMap(prev => new Map(prev).set(String(id), originalStatus))
      }
    }
  }

  return (
    <div class="cards">
      {devices.length === 0 && (
        <div class="empty">No devices found.</div>
      )}
      {devices.map(d => (
        <DeviceCard
          key={String(d.id ?? d.imei ?? d.device_id)}
          device={d}
          status={statusMap.get(String(d.id ?? d.imei ?? d.device_id))}
          onControlChange={onControlChange}
          onPower={onPower}
        />
      ))}
    </div>
  )
}
