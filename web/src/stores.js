import { writable } from 'svelte/store'

// Core app stores
export const creds = writable(null)
export const devices = writable([])
export const statusMap = writable(new Map())
export const autoEnabled = writable(true)
export const autoSec = writable(5)
export const statusLine = writable('')

// Initialize creds from storage at module load
try {
  const s = sessionStorage.getItem('electraCreds')
  if (s) creds.set(JSON.parse(s))
  else {
    const l = localStorage.getItem('electraCreds')
    if (l) creds.set(JSON.parse(l))
  }
} catch {}
