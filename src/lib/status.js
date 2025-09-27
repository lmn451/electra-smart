export function mapStatusFields(s) {
  const cj = s?.commandJson || {};
  const operoper = cj?.OPER?.OPER || {};
  const diag = cj?.DIAG_L2?.DIAG_L2 || {};
  const hasFlag = Object.prototype.hasOwnProperty.call(operoper, 'TURN_ON_OFF');
  const isOn = hasFlag ? (operoper.TURN_ON_OFF !== 'OFF') : (operoper.AC_MODE !== 'STBY');
  return {
    isOn,
    mode: operoper.AC_MODE ?? 'STBY',
    fan: operoper.FANSPD ?? 'OFF',
    spt: operoper.SPT ?? null,
    current: pickCurrentTemp(diag),
    raw: s,
  };
}

export function pickCurrentTemp(diagL2) {
  if (!diagL2) return null;
  const keys = ['I_RAT','I_CALC_AT','I_RCT'];
  for (const k of keys) {
    const v = diagL2[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= -5 && n <= 42) return n;
    }
  }
  return null;
}
