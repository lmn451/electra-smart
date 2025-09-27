import { h } from 'preact'

export function ModeSelect({ id, value, onChange }) {
  return (
    <select id={`modeSel-${id}`} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Mode…</option>
      <option value="STBY">STBY (Standby)</option>
      <option value="COOL">COOL</option>
      <option value="FAN">FAN</option>
      <option value="DRY">DRY</option>
      <option value="HEAT">HEAT</option>
      <option value="AUTO">AUTO</option>
    </select>
  )
}

export function FanSelect({ id, value, onChange }) {
  return (
    <select id={`fanSel-${id}`} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Fan…</option>
      <option value="LOW">LOW</option>
      <option value="MED">MED</option>
      <option value="HIGH">HIGH</option>
      <option value="AUTO">AUTO</option>
    </select>
  )
}
