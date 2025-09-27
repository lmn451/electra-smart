<script>
  import { onMount } from 'svelte'
  import { creds, autoEnabled, autoSec, statusLine } from './stores.js'
  import AuthPanel from './components/AuthPanel.svelte'
  import Devices from './components/Devices.svelte'

  let hasCreds = false
  const unsubscribe = creds.subscribe(v => { hasCreds = !!v })
  onMount(() => () => unsubscribe())
</script>

<h1>Electra Control</h1>

{#if !hasCreds}
  <AuthPanel />
{:else}
  <div class="toolbar">
    <button on:click={() => window.dispatchEvent(new CustomEvent('reload-devices'))}>Refresh All</button>
    <label>
      <input type="checkbox" bind:checked={$autoEnabled} aria-label="Toggle auto refresh"> Auto-refresh
    </label>
    <label>
      every
      <input type="number" bind:value={$autoSec} min="5" max="300" step="5" aria-label="Auto refresh interval in seconds" />
      sec
    </label>
    <span class="status" role="status" aria-live="polite">{$statusLine}</span>
  </div>
  <Devices />
{/if}
