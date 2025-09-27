import { h } from 'preact'

export default function Toolbar({ autoEnabled, setAutoEnabled, autoSec, setAutoSec, autoStatus, statusLine, onRefreshAll }) {
  return (
    <div class="toolbar">
      <button onClick={onRefreshAll}>Refresh All</button>
      <label>
        <input type="checkbox" checked={autoEnabled} onChange={e => setAutoEnabled(e.currentTarget.checked)} /> Auto-refresh
      </label>
      <label>
        every
        <input
          type="number"
          value={autoSec}
          min={5}
          max={300}
          step={5}
          onChange={e => setAutoSec(Number(e.currentTarget.value || 5))}
        />
        sec
      </label>
      <span class="status">{autoStatus}</span>
      <span class="status">{statusLine}</span>
    </div>
  )
}
