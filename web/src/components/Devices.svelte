<script>
  import { onMount } from 'svelte'
  import { devices as devicesStore, statusMap, autoEnabled, autoSec, statusLine, creds } from '../stores.js'
  import { fetchDevices, fetchStatus, mapStatusFields } from '../lib/api.js'
  import DeviceCard from './DeviceCard.svelte'

  let unsub = null
  let intervalId = null

  function setStatus(text) { statusLine.set(text || '') }

  async function loadDevices() {
    const c = get(creds)
    if (!c) { setStatus('Sign in to view devices'); devicesStore.set([]); return }
    setStatus('Loading devices…')
    try {
      const list = await fetchDevices()
      const arr = Array.isArray(list) ? list : (list.devices || [])
      devicesStore.set(arr)
      // load statuses in parallel
      await Promise.all(arr.map(d => refreshDevice(d.id)))
      setStatus('')
    } catch (e) {
      setStatus(`Failed to load devices: ${e.message}`)
    }
  }

  async function refreshDevice(id) {
    try {
      const s = await fetchStatus(id)
      const fields = mapStatusFields(s)
      statusMap.update(m => new Map(m.set(String(id), fields)))
    } catch (e) {
      setStatus(`Status error for ${id}: ${e.message}`)
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    const sec = Math.max(1, Number($autoSec) || 5)
    if (!$autoEnabled) return
    intervalId = setInterval(() => {
      $devicesStore.forEach(d => refreshDevice(d.id))
    }, sec * 1000)
  }

  function stopAutoRefresh() { if (intervalId) clearInterval(intervalId); intervalId = null }

  import { get } from 'svelte/store'

  onMount(() => {
    const reload = () => loadDevices()
    window.addEventListener('reload-devices', reload)
    const unsubAE = autoEnabled.subscribe(startAutoRefresh)
    const unsubAS = autoSec.subscribe(startAutoRefresh)
    const unsubCreds = creds.subscribe(v => { if (v) loadDevices(); else { stopAutoRefresh(); devicesStore.set([]) } })
    loadDevices()
    const vis = () => { if (document.hidden) stopAutoRefresh(); else startAutoRefresh() }
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('reload-devices', reload)
      document.removeEventListener('visibilitychange', vis)
      unsubAE(); unsubAS(); unsubCreds(); stopAutoRefresh()
    }
  })
</script>

<div class="cards">
  {#if $devicesStore.length === 0}
    <div class="empty">No devices found.</div>
  {:else}
    {#each $devicesStore as d (d.id)}
      <DeviceCard {d} />
    {/each}
  {/if}
</div>
