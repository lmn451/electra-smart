import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { apiFetch, endpoints, getCreds, setCreds, clearCreds } from '../lib/api'

export default function AuthPanel({ signedIn, onSignedIn, onSignedOut }) {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [imei, setImei] = useState('')
  const [remember, setRemember] = useState(false)
  const [status, setStatus] = useState('')
  const [resendLeft, setResendLeft] = useState(0)
  const resendTimerRef = useRef(null)

  const otpRefs = Array.from({ length: 6 }, () => useRef(null))

  useEffect(() => {
    return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current) }
  }, [])

  useEffect(() => {
    const creds = getCreds()
    if (creds) {
      setStep('code')
    }
  }, [])

  function startResendCountdown() {
    setResendLeft(30)
    if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    resendTimerRef.current = setInterval(() => {
      setResendLeft((n) => {
        if (n <= 1) { clearInterval(resendTimerRef.current); resendTimerRef.current = null; return 0 }
        return n - 1
      })
    }, 1000)
  }

  function readOtp() {
    return otpRefs.map(r => r.current?.value?.trim() || '').join('')
  }

  function clearOtp() {
    otpRefs.forEach(r => { if (r.current) r.current.value = '' })
  }

  async function sendOtp(isResend = false) {
    try {
      setStatus('')
      const body = isResend && imei ? { phone, imei } : { phone }
      const res = await apiFetch(endpoints.authStart, { method: 'POST', body: JSON.stringify(body) })
      const newImei = res?.imei
      if (!newImei) throw new Error('No IMEI returned')
      setImei(newImei)
      setStep('code')
      clearOtp()
      startResendCountdown()
      setStatus('Code sent')
    } catch (e) {
      setStatus(`Send failed: ${e.message}`)
    }
  }

  async function verify() {
    const code = readOtp()
    if (!phone || !imei || !code) { setStatus('Enter phone and full code'); return }
    try {
      const res = await apiFetch(endpoints.authVerify, { method: 'POST', body: JSON.stringify({ imei, phone, code }) })
      if (!res?.token) throw new Error('No token')
      setCreds({ imei, token: res.token }, remember)
      setStatus('Signed in')
      onSignedIn?.()
    } catch (e) {
      setStatus(`Verify failed: ${e.message}`)
    }
  }

  function logout() {
    clearCreds()
    setStatus('Signed out')
    onSignedOut?.()
    setStep('phone')
  }

  if (signedIn) {
    return (
      <div class="auth-panel">
        <div class="auth-actions">
          <button class="btn secondary" onClick={logout}>Logout</button>
        </div>
        <span class="status">{status}</span>
      </div>
    )
  }

  return (
    <div class="auth-panel">
      <h2>Sign in</h2>
      {step === 'phone' && (
        <div class="auth-step">
          <label>
            Phone
            <input type="tel" placeholder="05XXXXXXXX" inputmode="tel" autocomplete="tel" value={phone} onInput={e => setPhone(e.currentTarget.value)} />
          </label>
          <button class="btn primary" onClick={() => sendOtp(false)}>Send code</button>
        </div>
      )}

      {step === 'code' && (
        <div class="auth-step">
          <p class="muted">Enter the 6-digit code sent to <strong>{phone}</strong></p>
          <div class="otp-grid" role="group" aria-label="One-time code">
            {otpRefs.map((ref, i) => (
              <input key={i} ref={ref} inputmode="numeric" pattern="[0-9]*" maxLength={1} onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0,1)
                if (e.currentTarget.value && i < otpRefs.length - 1) otpRefs[i+1].current?.focus()
              }} onKeyDown={(e) => {
                if (e.key === 'Backspace' && !e.currentTarget.value && i > 0) otpRefs[i-1].current?.focus()
              }} />
            ))}
          </div>
          <input type="text" readOnly class="visually-hidden" aria-hidden="true" tabIndex={-1} value={imei} />
          <div class="auth-row">
            <label class="remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.currentTarget.checked)} /> Remember me
            </label>
          </div>
          <div class="auth-actions">
            <button class="btn primary" onClick={verify}>Verify</button>
            <button class="btn secondary" disabled={resendLeft>0} onClick={() => sendOtp(true)}>Resend</button>
            <span class="muted">{resendLeft>0 ? `You can resend in ${resendLeft}s` : ''}</span>
          </div>
          <div class="auth-links">
            <button class="linklike" type="button" onClick={() => { setImei(''); clearOtp(); setStep('phone') }}>Edit phone</button>
          </div>
        </div>
      )}

      <span class="status">{status}</span>
    </div>
  )
}
