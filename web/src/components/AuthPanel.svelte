<script>
  import { createEventDispatcher } from 'svelte'
  import { creds, statusLine } from '../stores.js'
  import { startOtp, verifyOtp, setCreds } from '../lib/api.js'
  import OtpInput from './OtpInput.svelte'

  const dispatch = createEventDispatcher()

  let phone = ''
  let imei = ''
  let otp = ''
  let remember = false
  let step = 'phone'
  let resendSec = 30
  let resendTimerId = null
  let resendRemaining = 0

  function startResendTimer() {
    stopResendTimer()
    resendRemaining = resendSec
    resendTimerId = setInterval(() => {
      resendRemaining -= 1
      if (resendRemaining <= 0) stopResendTimer()
    }, 1000)
  }

  function stopResendTimer() {
    if (resendTimerId) clearInterval(resendTimerId)
    resendTimerId = null
    resendRemaining = 0
  }

  let sending = false
  let verifying = false

  function normalizePhone(p) {
    return (p || '').trim()
  }

  async function onSendOtp(isResend = false) {
    const p = normalizePhone(phone)
    if (!p) { statusLine.set('Enter phone number'); return }
    sending = true
    try {
      const payloadImei = isResend && imei ? imei : undefined
      const res = await startOtp(p, payloadImei)
      imei = res?.imei || ''
      if (!imei) throw new Error('No IMEI returned')
      statusLine.set('Code sent')
      otp = ''
      step = 'code'
      startResendTimer()
    } catch (e) {
      statusLine.set(`Send failed: ${e.message}`)
    } finally {
      sending = false
    }
  }

  async function onVerify() {
    const code = (otp || '').replace(/\D/g, '')
    if (!phone || !imei || code.length !== 4) { statusLine.set('Enter the 4-digit code'); return }
    verifying = true
    try {
      const res = await verifyOtp(imei, normalizePhone(phone), code)
      if (!res?.token) throw new Error('No token returned')
      setCreds({ imei, token: res.token }, !!remember)
      creds.set({ imei, token: res.token })
      statusLine.set('Signed in')
      dispatch('signedin')
    } catch (e) {
      statusLine.set(`Verify failed: ${e.message}`)
    } finally {
      verifying = false
    }
  }

  function editPhone() {
    imei = ''
    otp = ''
    step = 'phone'
  }
</script>

<div class="auth-panel">
  <h2>Sign in</h2>

  {#if step === 'phone'}
    <div class="auth-step">
      <label>
        Phone
        <input type="tel" bind:value={phone} placeholder="05XXXXXXXX" inputmode="tel" autocomplete="tel" aria-label="Phone number" />
      </label>
      <button class="btn primary" on:click={() => onSendOtp(false)} disabled={sending}>Send code</button>
    </div>
  {:else}
    <div class="auth-step">
      <p class="muted">Enter the 4-digit code sent to <strong>{phone}</strong></p>
      <div class="otp-grid" aria-label="One-time code">
        <OtpInput bind:value={otp} length={4} on:complete={onVerify} disabled={verifying} />
      </div>
      <div class="auth-row">
        <label class="remember">
          <input type="checkbox" bind:checked={remember} /> Remember me
        </label>
      </div>
      <div class="auth-actions">
        <button class="btn primary" on:click={onVerify} disabled={verifying || otp.length !== 4}>Verify</button>
        <button class="btn secondary" on:click={() => onSendOtp(true)} disabled={!!resendTimerId} aria-disabled={!!resendTimerId}>
          Resend
        </button>
        <span class="muted">{#if resendRemaining > 0}You can resend in {resendRemaining}s{/if}</span>
      </div>
      <div class="auth-links">
        <button class="linklike" type="button" on:click={editPhone}>Edit phone</button>
      </div>
    </div>
  {/if}
</div>
