<script>
  import { onMount, createEventDispatcher } from "svelte";
  export let length = 4;
  export let disabled = false;
  export let autoFocus = true;
  export let name = "otp";
  export let ariaLabelPrefix = "OTP digit";

  // Expose the combined value
  export let value = "";
  const dispatch = createEventDispatcher();

  let inputs = [];

  function digitsOnly(s) {
    return (s || "").replace(/\D/g, "");
  }

  function setValueFromArray(arr) {
    value = arr.join("");
    dispatch("change", { value });
    if (value.length === length) dispatch("complete", { value });
  }

  function handleInput(e, idx) {
    if (disabled) return;
    const t = e.target;
    t.value = digitsOnly(t.value).slice(0, 1);
    // Build array from current inputs
    const arr = Array.from({ length }, (_, i) => inputs[i]?.value || "");
    setValueFromArray(arr);
    if (t.value && idx < length - 1) inputs[idx + 1]?.focus();
  }

  function handleKeydown(e, idx) {
    if (disabled) return;
    const key = e.key;
    if (key === "Backspace" && !inputs[idx].value && idx > 0) {
      inputs[idx - 1]?.focus();
    }
    if (key === "ArrowLeft" && idx > 0) inputs[idx - 1]?.focus();
    if (key === "ArrowRight" && idx < length - 1) inputs[idx + 1]?.focus();
  }

  function handlePaste(e) {
    if (disabled) return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const digits = digitsOnly(text).slice(0, length).split("");
    if (!digits.length) return;
    e.preventDefault();
    for (let i = 0; i < length; i++) {
      if (inputs[i]) inputs[i].value = digits[i] || "";
    }
    setValueFromArray(digits);
    const lastIdx = Math.min(digits.length - 1, length - 1);
    inputs[lastIdx]?.focus();
  }

  onMount(() => {
    if (autoFocus && inputs[0]) inputs[0].focus();
  });
</script>

<div role="group" aria-label="One-time code input">
  {#each Array.from({ length }) as _, idx}
    <input
      bind:this={inputs[idx]}
      type="tel"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="1"
      autocomplete="one-time-code"
      aria-label={`${ariaLabelPrefix} ${idx + 1} of ${length}`}
      {disabled}
      on:input={(e) => handleInput(e, idx)}
      on:keydown={(e) => handleKeydown(e, idx)}
      on:paste={(e) => idx === 0 && handlePaste(e)}
      class="otp-cell"
    />
  {/each}
</div>

<style>
  .otp-cell {
    width: 100%;
    max-width: 48px;
    text-align: center;
    font-size: 24px;
    padding: 0.8rem 0;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: #101418;
    color: var(--fg);
    margin-right: 0.5rem;
  }
  div[role="group"] {
    display: grid;
    grid-template-columns: repeat(var(--otp-cols, 4), 1fr);
    gap: 0.5rem;
  }
</style>
