import { h } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import Toolbar from './components/Toolbar'
import AuthPanel from './components/AuthPanel'
import { apiFetch, endpoints, getCreds } from './lib/api'
import { mapStatusFields } from './lib/status'
import { DevicesList } from './components/Devices'

export default function App() {
  const [creds, setCredsState] = useState(getCreds())
  const [devices, setDevices] = useState([])
  const [statusMap, setStatusMap] = useState(new Map())
  const [statusLine, setStatusLine] = useState('')

  const [autoEnabled, setAutoEnabled] = useState(true)
  const [autoSec, setAutoSec] = useState(5)
  const timerRef = useRef(null)

  function autoStatusText() {
    if (!autoEnabled) return 'Auto-refresh: Off'
    if (!timerRef.current) return 'Auto-refresh: Paused'
    return `Auto-refresh: On (${autoSec}s)`
  }

  async function loadDevices() {
    if (!getCreds()) { setStatusLine('Sign in to view devices'); return }
    setStatusLine('Loading devices…')
    try {
      const list = await apiFetch(endpoints.listDevices)
      const arr = Array.isArray(list) ? list : (list.devices || [])
      setDevices(arr)
      await Promise.all(arr.map(d => refreshDevice(d.id)))
      setStatusLine('')
    } catch (e) {
      setStatusLine('Failed to load devices')
    }
  }

  async function refreshDevice(id) {
    try {
      const s = await apiFetch(endpoints.deviceStatus(id))
      const fields = mapStatusFields(s)
      setStatusMap((prev) => {
        const next = new Map(prev)
        next.set(String(id), fields)
        return next
      })
    } catch (e) {
      setStatusLine(`Status error for ${id}: ${e.message}`)
    }
  }

  function restartTimer(enabled = autoEnabled, sec = autoSec) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (!enabled) return
    timerRef.current = setInterval(() => {
      devices.forEach(d => refreshDevice(d.id))
    }, Math.max(1, Number(sec) || 5) * 1000)
  }

  useEffect(() => {
    restartTimer(autoEnabled, autoSec)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoEnabled, autoSec, devices])

  useEffect(() => {
    function onVis() {
      if (document.hidden) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      } else if (autoEnabled) {
        restartTimer(true, autoSec)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [autoEnabled, autoSec])

  useEffect(() => {
    if (creds) loadDevices()
  }, [creds])

  useEffect(() => {
    function onOffline() { setStatusLine('You are offline') }
    function onOnline() { setStatusLine('') }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return (
    <div>
      <h1>Electra Control</h1>
      <AuthPanel
        signedIn={!!creds}
        onSignedIn={() => setCredsState(getCreds())}
        onSignedOut={() => { setCredsState(null); setDevices([]); statusMap.clear() }}
      />

      {creds && (
        <Toolbar
          autoEnabled={autoEnabled}
          setAutoEnabled={(v) => setAutoEnabled(!!v)}
          autoSec={autoSec}
          setAutoSec={(n) => setAutoSec(Math.max(1, Number(n) || 5))}
          autoStatus={autoStatusText()}
          statusLine={statusLine}
          onRefreshAll={loadDevices}
        />
      )}

      {creds && (
        <DevicesList devices={devices} statusMap={statusMap} setStatusLine={setStatusLine} setStatusMap={setStatusMap} />
      )}
    </div>
  )
}
