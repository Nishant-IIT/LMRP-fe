// Shared line-chart geometry, used by the Participants trajectory/population
// charts and the Profiles cluster-trajectory chart. W/H/PL/PR/PT/PB are the
// default canvas + padding a chart uses when it doesn't pass its own.
export const W = 560;
export const H = 190;
export const PL = 46;
export const PR = 12;
export const PT = 14;
export const PB = 26;

export function gx(week: number, w?: number, pl?: number, pr?: number): number {
  const plv = pl === undefined ? PL : pl;
  const prv = pr === undefined ? PR : pr;
  return plv + (week / 12) * ((w || W) - plv - prv);
}

export function gy(v: number, lo: number, hi: number, h?: number): number {
  const hh = h || H;
  return PT + (1 - (v - lo) / (hi - lo || 1)) * (hh - PT - PB);
}

export function ticks(lo: number, hi: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(lo + ((hi - lo) * i) / n);
  return out;
}
