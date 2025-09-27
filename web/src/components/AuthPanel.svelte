<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { creds, statusLine } from '../stores.js'
  import { startOtp, verifyOtp, setCreds } from '../lib/api.js'

  const dispatch = createEventDispatcher()

  let phone = ''
  let imei = ''
  let code = ['', '', '', '', '', '']
  let remember = false
  let step = 'phone'
  let resendSec = 30
  let resendTimerId = null

  function codeString() { return code.join('').replace(/\D/g, '') }

  function startResendTimer() {
    stopResendTimer()
    let remaining = resendSec
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) stopResendTimer()
      else resendText = `You can resend in ${remaining}s`
    }
    resendText = `You can resend in ${remaining}s`
    resendTimerId = setInterval(tick, 1000)
  }

  function stopResendTimer() {
    if (resendTimerId) clearInterval(resendTimerId)
    resendTimerId = null
    resendText = ''
  }

  let resendText = ''
  let sending = false
  let verifying = false

  async function onSendOtp(isResend = false) {
    if (!phone) { statusLine.set('Enter phone number'); return }
    sending = true
    try {
      const payloadImei = isResend && imei ? imei : undefined
      const res = await startOtp(phone, payloadImei)
      imei = res?.imei || ''
      if (!imei) throw new Error('No IMEI returned')
      statusLine.set('Code sent')
      code = ['', '', '', '', '', '']
      step = 'code'
      startResendTimer()
    } catch (e) {
      statusLine.set(`Send failed: ${e.message}`)
    } finally {
      sending = false
    }
  }

  async function onVerify() {
    const c = codeString()
    if (!phone || !imei || !c) { statusLine.set('Enter phone and full code'); return }
    verifying = true
    try {
      const res = await verifyOtp(imei, phone, c)
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
    code = ['', '', '', '', '', '']
    step = 'phone'
  }
</script>

<div class="auth-panel">
  <h2>Sign in</h2>

  {#if step === 'phone'}
    <div class="auth-step">
      <label>
        Phone
        <input type="tel" bind:value={phone} placeholder="05XXXXXXXX" inputmode="tel" autocomplete="tel" />
      </label>
      <button class="btn primary" on:click={() => onSendOtp(false)} disabled={sending}>Send code</button>
    </div>
  {:else}
    <div class="auth-step">
      <p class="muted">Enter the 6-digit code sent to <strong>{phone}</strong></p>
      <div class="otp-grid" role="group" aria-label="One-time code">
        {#each [0,1,2,3,4,5] as i}
          <input bind:value={code[i]} inputmode="numeric" pattern="[0-9]*" maxlength="1" />
        {/each}
      </div>
      <div class="auth-row">
        <label class="remember">
          <input type="checkbox" bind:checked={remember} /> Remember me
        </label>
      </div>
      <div class="auth-actions">
        <button class="btn primary" on:click={onVerify} disabled={verifying}>Verify</button>
        <button class="btn secondary" on:click={() => onSendOtp(true)} disabled={!!resendTimerId}>Resend</button>
        <span class="muted">{resendText}</span>
      </div>
      <div class="auth-links">
        <button class="linklike" type="button" on:click={editPhone}>Edit phone</button>
      </div>
    </div>
  {/if}
</div>
