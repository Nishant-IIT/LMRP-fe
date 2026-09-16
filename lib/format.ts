export const fmt = (v: number | null | undefined, d?: number): string =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d === undefined ? 2 : d);

export const pct1 = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(1) + "%";
