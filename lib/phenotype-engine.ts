// Analysis engine for the phenotyping MVP sample: synthetic cohort generator,
// preprocessing, three clustering adapters, cluster metrics, bootstrap stability,
// and two supervised classifiers. Method-agnostic: adapters are registered in
// ALGORITHMS / CLASSIFIERS and resolved by id, never hard-coded at call sites.
//
// Ported from the Claude Design canvas's phenotype-engine.js — numerics are
// kept bit-for-bit identical (same constants, loop bounds, formulas) because
// the UI advertises exact reproducibility from a seed.

import type {
  MeasureId,
  Timepoint,
  Measure,
  Pattern,
  Cohort,
  Observation,
  Participant,
  QualityFlag,
  QualityGridCell,
  QualityReport,
  FeatureSet,
  Features,
  Algorithm,
  ClusterMetrics,
  BootstrapResult,
  TrajPoint,
  DomainProfile,
  ClusterProfile,
  EarlyModel,
  Classifier,
  PerClassMetric,
  CalibrationBin,
  ClassifierResult,
} from "./types";

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number): number {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

export const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export const sd = (a: number[]): number => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
export const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};
export const quantile = (a: number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return 0;
  const i = (s.length - 1) * q,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

export const TIMEPOINTS: Timepoint[] = [
  { id: "T0", label: "Baseline", short: "BL", week: 0 },
  { id: "T1", label: "Week 2", short: "W2", week: 2 },
  { id: "T2", label: "Week 4", short: "W4", week: 4 },
  { id: "T3", label: "Week 6", short: "W6", week: 6 },
  { id: "T4", label: "Week 8", short: "W8", week: 8 },
  { id: "T5", label: "Week 12", short: "W12", week: 12 },
];

// The outcome-measure configuration layer. Adding a row here changes the
// whole pipeline — no schema change, no call-site edits.
export const MEASURES: Measure[] = [
  { id: "nprs", domain: "Pain", name: "NPRS", full: "Numeric Pain Rating Scale", min: 0, max: 10, dir: "worse", items: 1, unit: "/10", active: true },
  { id: "odi", domain: "Disability", name: "ODI", full: "Oswestry Disability Index", min: 0, max: 100, dir: "worse", items: 10, unit: "%", active: true },
  { id: "sts", domain: "Function", name: "5xSTS", full: "Five-times sit-to-stand", min: 3, max: 40, dir: "worse", items: 1, unit: "s", active: true },
  { id: "fabq", domain: "Psychosocial", name: "FABQ-PA", full: "Fear-Avoidance Beliefs, physical activity", min: 0, max: 24, dir: "worse", items: 4, active: true },
  { id: "pseq", domain: "Psychosocial", name: "PSEQ", full: "Pain Self-Efficacy Questionnaire", min: 0, max: 60, dir: "better", items: 10, active: false },
  { id: "tug", domain: "Function", name: "TUG", full: "Timed up-and-go", min: 4, max: 30, dir: "worse", items: 1, unit: "s", active: false },
];
export const ACTIVE: Measure[] = MEASURES.filter((m) => m.active);
export const DOMAINS = ["Pain", "Disability", "Function", "Psychosocial"];

// Known latent patterns built into the synthetic data, so the pipeline can be
// checked against ground truth before real participants exist.
export const PATTERNS: Pattern[] = [
  { id: 0, name: "Rapid recovery", share: 0.28, curves: { nprs: [1, 0.55, 0.32, 0.22, 0.16, 0.12], odi: [1, 0.62, 0.4, 0.28, 0.2, 0.15], sts: [1, 0.7, 0.52, 0.4, 0.32, 0.27], fabq: [1, 0.72, 0.56, 0.46, 0.39, 0.34] } },
  { id: 1, name: "Delayed recovery", share: 0.24, curves: { nprs: [1, 0.95, 0.82, 0.62, 0.42, 0.26], odi: [1, 0.97, 0.88, 0.7, 0.5, 0.33], sts: [1, 0.98, 0.9, 0.75, 0.57, 0.41], fabq: [1, 0.96, 0.88, 0.75, 0.61, 0.47] } },
  { id: 2, name: "Persistent symptoms", share: 0.26, curves: { nprs: [1, 0.96, 0.94, 0.92, 0.9, 0.88], odi: [1, 0.98, 0.96, 0.94, 0.92, 0.9], sts: [1, 0.99, 0.97, 0.96, 0.95, 0.94], fabq: [1, 1.02, 1.01, 0.99, 0.98, 0.97] } },
  { id: 3, name: "Discordant (pain-led)", share: 0.22, curves: { nprs: [1, 0.62, 0.4, 0.3, 0.24, 0.2], odi: [1, 0.95, 0.91, 0.87, 0.85, 0.83], sts: [1, 0.91, 0.86, 0.82, 0.79, 0.77], fabq: [1, 0.98, 0.97, 0.95, 0.94, 0.93] } },
];

const BASE: Record<string, [number, number, number, number]> = { nprs: [6.6, 1.4, 3, 10], odi: [42, 13, 8, 86], sts: [14, 4, 6, 32], fabq: [15, 4.5, 2, 24] };
const DROP = [0, 0.035, 0.065, 0.1, 0.135, 0.175];
const NOISE: Record<string, number> = { nprs: 0.55, odi: 4.2, sts: 1.1, fabq: 1.6 };

export function makeCohort(n = 300, seed = 20260913): Cohort {
  const r = rng(seed);
  const participants: Participant[] = [];
  const cum: number[] = [];
  let acc = 0;
  PATTERNS.forEach((p) => {
    acc += p.share;
    cum.push(acc);
  });
  for (let i = 0; i < n; i++) {
    const u = r();
    const idx = cum.findIndex((c) => u <= c);
    const pat = PATTERNS[idx === -1 ? 3 : idx];
    const sid = "LBP-" + String(i + 1).padStart(4, "0");
    const base: Partial<Record<MeasureId, number>> = {};
    ACTIVE.forEach((m) => {
      const [mu, s, lo, hi] = BASE[m.id];
      base[m.id] = clamp(mu + gauss(r) * s, lo, hi);
    });
    const frailty = 0.8 + r() * 0.45;
    const obs: Observation[] = TIMEPOINTS.map((tp, ti) => {
      if (ti > 0 && r() < DROP[ti]) return { tp: tp.id, missing: true, values: {}, complete: 0 };
      const values: Partial<Record<MeasureId, number | null>> = {};
      let present = 0,
        itemsMissing = 0;
      ACTIVE.forEach((m) => {
        const extra = m.id === "odi" ? 0.028 : m.id === "fabq" ? 0.022 : m.id === "sts" ? 0.035 : 0.008;
        // Baseline gets item-level missingness too, at about a third of the follow-up rate.
        if (r() < (ti === 0 ? extra * 0.35 : extra)) {
          values[m.id] = null;
          itemsMissing++;
          return;
        }
        const k = pat.curves[m.id][ti];
        const drift = 1 + (k < 1 ? (frailty - 1) * (1 - k) * 0.9 : 0);
        let v = base[m.id]! * k * drift + gauss(r) * NOISE[m.id];
        const [, , lo, hi] = BASE[m.id];
        v = clamp(v, m.id === "nprs" ? 0 : lo * 0.6, hi);
        values[m.id] = m.id === "nprs" ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;
        present++;
      });
      return { tp: tp.id, missing: false, values, complete: present / ACTIVE.length, itemsMissing };
    });
    const conv = base.odi! + base.fabq! * 1.6 + gauss(r) * 9;
    participants.push({
      sid,
      pattern: pat.id,
      age: Math.round(clamp(44 + gauss(r) * 13, 19, 79)),
      sex: r() < 0.54 ? "F" : "M",
      bmi: Math.round(clamp(26.4 + gauss(r) * 4.1, 17, 42) * 10) / 10,
      durationWeeks: Math.round(clamp(9 + Math.abs(gauss(r)) * 14, 2, 96)),
      episodes: Math.floor(r() * 4),
      conventional: conv > 92 ? "high" : conv > 66 ? "moderate" : "low",
      site: ["Site A", "Site B", "Site C"][Math.floor(r() * 3)],
      obs,
    });
  }
  // Seeded data-quality faults so the quality module has something to catch.
  const flags: QualityFlag[] = [];
  participants[17].obs[2].values.odi = 104;
  flags.push({ sid: participants[17].sid, tp: "T2", kind: "Out of range", detail: "ODI = 104 (valid 0–100)" });
  participants[44].obs[0].values.sts = 0.4;
  flags.push({ sid: participants[44].sid, tp: "T0", kind: "Impossible value", detail: "5xSTS = 0.4 s" });
  participants[91].obs[3].values.nprs = null;
  participants[91].obs[3].itemsMissing = 1;
  flags.push({ sid: participants[102].sid, tp: "T1", kind: "Duplicate record", detail: "Two T1 assessments, 4 min apart" });
  flags.push({ sid: participants[138].sid, tp: "T3", kind: "Inconsistent date", detail: "W6 assessment dated before W4" });
  flags.push({ sid: participants[203].sid, tp: "T2", kind: "Inconsistent responses", detail: "ODI 78 with NPRS 0" });
  return { participants, flags, n, seed, version: "synthetic-v4" };
}

export function qualityReport(cohort: Cohort): QualityReport {
  const perMeasure: Partial<Record<MeasureId, { present: number; missing: number }>> = {};
  ACTIVE.forEach((m) => {
    perMeasure[m.id] = { present: 0, missing: 0 };
  });
  const grid: QualityGridCell[] = [];
  TIMEPOINTS.forEach((tp, ti) => {
    const cell: QualityGridCell = { tp: tp.id, assessed: 0, missingAssessment: 0, byMeasure: {} };
    ACTIVE.forEach((m) => {
      cell.byMeasure[m.id] = { present: 0, missing: 0 };
    });
    cohort.participants.forEach((p) => {
      const o = p.obs[ti];
      if (o.missing) {
        cell.missingAssessment++;
        ACTIVE.forEach((m) => {
          cell.byMeasure[m.id]!.missing++;
          perMeasure[m.id]!.missing++;
        });
        return;
      }
      cell.assessed++;
      ACTIVE.forEach((m) => {
        const v = o.values[m.id];
        if (v === null || v === undefined) {
          cell.byMeasure[m.id]!.missing++;
          perMeasure[m.id]!.missing++;
        } else {
          cell.byMeasure[m.id]!.present++;
          perMeasure[m.id]!.present++;
        }
      });
    });
    grid.push(cell);
  });
  const pctMissing: Partial<Record<MeasureId, number>> = {};
  ACTIVE.forEach((m) => {
    const c = perMeasure[m.id]!;
    pctMissing[m.id] = (100 * c.missing) / (c.present + c.missing);
  });
  const completeBaseline = cohort.participants.filter(
    (p) => !p.obs[0].missing && ACTIVE.every((m) => p.obs[0].values[m.id] !== null && p.obs[0].values[m.id] !== undefined)
  ).length;
  const pMiss = cohort.participants.map((p) => p.obs.filter((o) => o.missing).length / TIMEPOINTS.length);
  return {
    grid,
    pctMissing,
    completeBaseline,
    incompleteBaseline: cohort.n - completeBaseline,
    flags: cohort.flags,
    participantMissingness: { mean: 100 * mean(pMiss), max: 100 * Math.max(...pMiss), noneMissing: pMiss.filter((x) => x === 0).length },
    overall: 100 * mean(ACTIVE.map((m) => pctMissing[m.id]!)),
  };
}

// ── Feature construction ──────────────────────────────────────────────────
export const FEATURE_SETS: FeatureSet[] = [
  { id: "baseline", name: "Baseline only", blocks: ["base"] },
  { id: "base_change", name: "Baseline + total change", blocks: ["base", "change"] },
  { id: "change_rate", name: "Change + rate of change", blocks: ["change", "rate"] },
  { id: "full", name: "Full longitudinal", blocks: ["base", "change", "rate", "var", "auc"] },
];
// Values outside the configured range never reach the analytical dataset:
// the quality module gates them, and they are represented as missing.
const series = (p: Participant, mid: MeasureId): (number | null)[] => {
  const m = MEASURES.find((x) => x.id === mid)!;
  return p.obs.map((o) => {
    if (o.missing) return null;
    const v = o.values[mid];
    if (v === null || v === undefined) return null;
    return v < m.min || v > m.max ? null : v;
  });
};
export const valid = (mid: MeasureId, v: number | null | undefined): boolean => {
  const m = MEASURES.find((x) => x.id === mid)!;
  return v !== null && v !== undefined && v >= m.min && v <= m.max;
};

export function buildFeatures(cohort: Cohort, setId: string, missingStrategy: string = "impute", enabled: MeasureId[] | null = null): Features {
  const set = FEATURE_SETS.find((s) => s.id === setId) || FEATURE_SETS[3];
  const use = enabled ? ACTIVE.filter((m) => enabled.includes(m.id)) : ACTIVE;
  const names: string[] = [];
  const rows: (number | null)[][] = [];
  use.forEach((m) => {
    if (set.blocks.includes("base")) names.push(m.name + " baseline");
    if (set.blocks.includes("change")) {
      names.push(m.name + " Δ BL→W4");
      names.push(m.name + " Δ BL→W12");
    }
    if (set.blocks.includes("rate")) {
      names.push(m.name + " early slope");
      names.push(m.name + " late slope");
    }
    if (set.blocks.includes("var")) names.push(m.name + " within-person SD");
    if (set.blocks.includes("auc")) names.push(m.name + " AUC");
  });
  cohort.participants.forEach((p) => {
    const row: (number | null)[] = [];
    use.forEach((m) => {
      const s = series(p, m.id);
      const sign = m.dir === "worse" ? -1 : 1; // align every variable to "higher = better recovery"
      const at = (i: number) => s[i];
      const first = s.find((v) => v !== null) ?? null;
      if (set.blocks.includes("base")) row.push(at(0) === null ? null : sign * at(0)!);
      if (set.blocks.includes("change")) {
        row.push(at(0) === null || at(2) === null ? null : sign * (at(2)! - at(0)!));
        row.push(at(0) === null || at(5) === null ? null : sign * (at(5)! - at(0)!));
      }
      if (set.blocks.includes("rate")) {
        row.push(at(0) === null || at(1) === null ? null : (sign * (at(1)! - at(0)!)) / 2);
        row.push(at(2) === null || at(5) === null ? null : (sign * (at(5)! - at(2)!)) / 8);
      }
      if (set.blocks.includes("var")) {
        const pres = s.filter((v): v is number => v !== null);
        row.push(pres.length < 3 ? null : sd(pres) / Math.abs(first || 1));
      }
      if (set.blocks.includes("auc")) {
        let a = 0,
          w = 0;
        for (let i = 1; i < s.length; i++) {
          if (s[i] === null || s[i - 1] === null) continue;
          const dt = TIMEPOINTS[i].week - TIMEPOINTS[i - 1].week;
          a += (dt * (s[i]! + s[i - 1]!)) / 2;
          w += dt;
        }
        row.push(w < 6 ? null : sign * (a / w) / Math.abs(first || 1));
      }
    });
    rows.push(row);
  });
  const keep: number[] = [];
  rows.forEach((row, i) => {
    if (missingStrategy !== "complete" || row.every((v) => v !== null)) keep.push(i);
  });
  const colMean = names.map((_, j) => mean(keep.map((i) => rows[i][j]).filter((v): v is number => v !== null)));
  const X = keep.map((i) => rows[i].map((v, j) => (v === null ? colMean[j] : v)));
  const mu = names.map((_, j) => mean(X.map((r2) => r2[j])));
  const sg = names.map((_, j) => sd(X.map((r2) => r2[j])) || 1);
  const Z = X.map((r2) => r2.map((v, j) => (v - mu[j]) / sg[j]));
  return { names, Z, keep, nDropped: cohort.n - keep.length, setName: set.name, used: use.map((m) => m.name) };
}

// ── Clustering adapters ───────────────────────────────────────────────────
const dist2 = (a: number[], b: number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
};
const centroid = (rowsIn: number[][]): number[] => rowsIn[0].map((_, j) => mean(rowsIn.map((r2) => r2[j])));

function kmeans(Z: number[][], k: number, seed = 7): number[] {
  const r = rng(seed),
    n = Z.length;
  let best: { lab: number[]; cent: number[][]; inertia: number } | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const cent: number[][] = [Z[Math.floor(r() * n)].slice()];
    while (cent.length < k) {
      const d = Z.map((p) => Math.min(...cent.map((c) => dist2(p, c))));
      const tot = d.reduce((a, b) => a + b, 0);
      let t = r() * tot,
        idx = 0;
      while (idx < n - 1 && (t -= d[idx]) > 0) idx++;
      cent.push(Z[idx].slice());
    }
    const lab: number[] = new Array(n).fill(0);
    for (let it = 0; it < 40; it++) {
      let moved = 0;
      for (let i = 0; i < n; i++) {
        let bi = 0,
          bd = Infinity;
        for (let c = 0; c < k; c++) {
          const d = dist2(Z[i], cent[c]);
          if (d < bd) {
            bd = d;
            bi = c;
          }
        }
        if (lab[i] !== bi) {
          lab[i] = bi;
          moved++;
        }
      }
      for (let c = 0; c < k; c++) {
        const m = Z.filter((_, i) => lab[i] === c);
        if (m.length) cent[c] = centroid(m);
      }
      if (!moved) break;
    }
    const inertia = Z.reduce((s, p, i) => s + dist2(p, cent[lab[i]]), 0);
    if (!best || inertia < best.inertia) best = { lab, cent, inertia };
  }
  return best!.lab;
}

function hierarchical(Z: number[][], k: number): number[] {
  const n = Z.length;
  const D: Float64Array[] = [];
  const size = new Array(n).fill(1);
  const alive = new Array(n).fill(true);
  for (let i = 0; i < n; i++) D.push(new Float64Array(n));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = dist2(Z[i], Z[j]);
      D[i][j] = d;
      D[j][i] = d;
    }
  const members: number[][] = Z.map((_, i) => [i]);
  let count = n;
  while (count > k) {
    let bi = -1,
      bj = -1,
      bd = Infinity;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        if (D[i][j] < bd) {
          bd = D[i][j];
          bi = i;
          bj = j;
        }
      }
    }
    for (let m = 0; m < n; m++) {
      if (!alive[m] || m === bi || m === bj) continue;
      const ni = size[bi],
        nj = size[bj],
        nm = size[m],
        t = ni + nj + nm;
      const nd = ((ni + nm) * D[bi][m] + (nj + nm) * D[bj][m] - nm * bd) / t; // Ward, Lance-Williams
      D[bi][m] = nd;
      D[m][bi] = nd;
    }
    members[bi] = members[bi].concat(members[bj]);
    size[bi] += size[bj];
    alive[bj] = false;
    count--;
  }
  const lab: number[] = new Array(n).fill(0);
  let c = 0;
  for (let i = 0; i < n; i++)
    if (alive[i]) {
      members[i].forEach((m) => {
        lab[m] = c;
      });
      c++;
    }
  return lab;
}

function gmm(Z: number[][], k: number, seed = 11): number[] {
  const n = Z.length,
    d = Z[0].length;
  const lab = kmeans(Z, k, seed + 3);
  const mu: number[][] = [],
    va: number[][] = [],
    pi: number[] = [];
  for (let c = 0; c < k; c++) {
    const m = Z.filter((_, i) => lab[i] === c);
    mu.push(m.length ? centroid(m) : Z[c % n].slice());
    va.push(mu[c].map((_, j) => Math.max(0.05, m.length > 1 ? sd(m.map((r2) => r2[j])) ** 2 : 1)));
    pi.push(Math.max(m.length, 1) / n);
  }
  const resp: number[][] = Z.map(() => new Array(k).fill(0));
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < n; i++) {
      let tot = 0;
      for (let c = 0; c < k; c++) {
        let lp = Math.log(pi[c]);
        for (let j = 0; j < d; j++) lp += -0.5 * (Math.log(2 * Math.PI * va[c][j]) + (Z[i][j] - mu[c][j]) ** 2 / va[c][j]);
        resp[i][c] = lp;
      }
      const mx = Math.max(...resp[i]);
      for (let c = 0; c < k; c++) {
        resp[i][c] = Math.exp(resp[i][c] - mx);
        tot += resp[i][c];
      }
      for (let c = 0; c < k; c++) resp[i][c] /= tot || 1;
    }
    for (let c = 0; c < k; c++) {
      let nk = 0;
      for (let i = 0; i < n; i++) nk += resp[i][c];
      nk = Math.max(nk, 1e-6);
      pi[c] = nk / n;
      for (let j = 0; j < d; j++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += resp[i][c] * Z[i][j];
        mu[c][j] = s / nk;
        let v = 0;
        for (let i = 0; i < n; i++) v += resp[i][c] * (Z[i][j] - mu[c][j]) ** 2;
        va[c][j] = Math.max(0.05, v / nk);
      }
    }
  }
  return Z.map((_, i) => resp[i].indexOf(Math.max(...resp[i])));
}

export const ALGORITHMS: Algorithm[] = [
  { id: "kmeans", name: "K-means", note: "Euclidean, k-means++ init, 6 restarts", run: kmeans },
  { id: "hier", name: "Hierarchical (Ward)", note: "Agglomerative, Ward linkage", run: hierarchical },
  { id: "gmm", name: "Gaussian mixture", note: "EM, diagonal covariance", run: gmm },
  { id: "spectral", name: "Spectral", note: "Adapter slot registered — not implemented in this sample", run: null },
];

// Relabel clusters by mean recovery so colour/order are stable as K changes.
function canonical(lab: number[], Z: number[][], k: number): number[] {
  const score: { c: number; v: number }[] = [];
  for (let c = 0; c < k; c++) {
    const m = Z.filter((_, i) => lab[i] === c);
    score.push({ c, v: m.length ? mean(m.map((r2) => mean(r2))) : -Infinity });
  }
  score.sort((a, b) => b.v - a.v);
  const map: Record<number, number> = {};
  score.forEach((s, i) => {
    map[s.c] = i;
  });
  return lab.map((l) => map[l]);
}

export function cluster(Z: number[][], algoId: string, k: number, seed = 7): number[] | null {
  const a = ALGORITHMS.find((x) => x.id === algoId);
  if (!a || !a.run) return null;
  return canonical(a.run(Z, k, seed), Z, k);
}

// ── Cluster quality metrics ────────────────────────────────────────────────
export function metrics(Z: number[][], lab: number[], k: number): ClusterMetrics {
  const n = Z.length,
    groups: number[][][] = [];
  for (let c = 0; c < k; c++) groups.push(Z.filter((_, i) => lab[i] === c));
  const cents = groups.map((g) => (g.length ? centroid(g) : Z[0]));
  const grand = centroid(Z);
  let wss = 0,
    bss = 0;
  groups.forEach((g, c) => {
    g.forEach((p) => {
      wss += dist2(p, cents[c]);
    });
    bss += g.length * dist2(cents[c], grand);
  });
  const step = Math.max(1, Math.round(n / 220));
  let sil = 0,
    cnt = 0;
  for (let i = 0; i < n; i += step) {
    const own = groups[lab[i]];
    if (own.length < 2) continue;
    const a = mean(own.filter((p) => p !== Z[i]).map((p) => Math.sqrt(dist2(Z[i], p))));
    let b = Infinity;
    groups.forEach((g, c) => {
      if (c === lab[i] || !g.length) return;
      b = Math.min(b, mean(g.map((p) => Math.sqrt(dist2(Z[i], p)))));
    });
    sil += (b - a) / Math.max(a, b);
    cnt++;
  }
  const scat = groups.map((g, c) => (g.length ? mean(g.map((p) => Math.sqrt(dist2(p, cents[c])))) : 0));
  let db = 0;
  for (let i = 0; i < k; i++) {
    let mx = 0;
    for (let j = 0; j < k; j++) if (i !== j) mx = Math.max(mx, (scat[i] + scat[j]) / Math.sqrt(dist2(cents[i], cents[j]) || 1e-9));
    db += mx;
  }
  const sizes = groups.map((g) => g.length);
  return {
    k,
    sizes,
    silhouette: cnt ? sil / cnt : 0,
    ch: bss / (k - 1) / (wss / (n - k)),
    db: db / k,
    wss,
    smallest: Math.min(...sizes),
    smallestPct: (100 * Math.min(...sizes)) / n,
  };
}

// Doubly generic on purpose: the UI compares category labels (e.g. the
// conventional risk group) against cluster ids — two different label
// spaces, paired positionally, never compared to each other directly.
export function ari<A, B>(a: A[], b: B[]): number {
  const A = [...new Set(a)],
    B = [...new Set(b)];
  const tab = A.map(() => B.map(() => 0));
  a.forEach((x, i) => {
    tab[A.indexOf(x)][B.indexOf(b[i])]++;
  });
  const n = a.length,
    C2 = (x: number) => (x * (x - 1)) / 2;
  let sij = 0,
    sa = 0,
    sb = 0;
  tab.forEach((row) => row.forEach((v) => { sij += C2(v); }));
  tab.forEach((row) => { sa += C2(row.reduce((p, q) => p + q, 0)); });
  B.forEach((_, j) => { sb += C2(tab.reduce((p, row) => p + row[j], 0)); });
  const exp = (sa * sb) / C2(n),
    mx = (sa + sb) / 2;
  return (sij - exp) / ((mx - exp) || 1e-9);
}

export function bootstrap(Z: number[][], algoId: string, k: number, iters = 40, seed = 99): BootstrapResult | null {
  const base = cluster(Z, algoId, k, seed);
  if (!base) return null;
  const r = rng(seed),
    n = Z.length;
  const aris: number[] = [];
  const agree = new Array(k).fill(0),
    seen = new Array(k).fill(0);
  for (let b = 0; b < iters; b++) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      idx.push(Math.floor(r() * n));
    }
    const sample = idx.map((j) => Z[j]);
    const lab = cluster(sample, algoId, k, seed + b * 13);
    if (!lab) continue;
    aris.push(ari(idx.map((j) => base[j]), lab));
    const pairs: Record<string, number> = {};
    idx.forEach((j, i) => {
      const key = base[j] + "|" + lab[i];
      pairs[key] = (pairs[key] || 0) + 1;
    });
    for (let c = 0; c < k; c++) {
      const tot = idx.filter((j) => base[j] === c).length;
      if (!tot) continue;
      let mx = 0;
      for (let c2 = 0; c2 < k; c2++) mx = Math.max(mx, pairs[c + "|" + c2] || 0);
      agree[c] += mx / tot;
      seen[c]++;
    }
  }
  return {
    iters: aris.length,
    meanARI: mean(aris),
    sdARI: sd(aris),
    lowARI: quantile(aris, 0.025),
    highARI: quantile(aris, 0.975),
    perCluster: agree.map((a, c) => (seen[c] ? (100 * a) / seen[c] : 0)),
  };
}

// ── Cluster profiling ───────────────────────────────────────────────────
export function profile(cohort: Cohort, feat: Features, lab: number[], k: number, enabled: MeasureId[] | null = null): ClusterProfile[] {
  const use = enabled ? ACTIVE.filter((m) => enabled.includes(m.id)) : ACTIVE;
  const out: ClusterProfile[] = [];
  for (let c = 0; c < k; c++) {
    const members = feat.keep.filter((_, i) => lab[i] === c).map((i) => cohort.participants[i]);
    const domains: DomainProfile[] = use.map((m) => {
      const traj: TrajPoint[] = TIMEPOINTS.map((tp, ti) => {
        const vals = members.map((p) => (p.obs[ti].missing ? null : p.obs[ti].values[m.id])).filter((v): v is number => valid(m.id, v));
        return {
          tp: tp.id,
          short: tp.short,
          week: tp.week,
          n: vals.length,
          mean: vals.length ? mean(vals) : null,
          lo: vals.length ? quantile(vals, 0.25) : null,
          hi: vals.length ? quantile(vals, 0.75) : null,
        };
      });
      const a = traj[0].mean;
      const z = traj[5].mean ?? traj[4].mean;
      const rel = a && z !== null ? (z - a) / a : 0;
      const signed = m.dir === "worse" ? -rel : rel;
      const w1 = traj[1].mean;
      const early = a && w1 !== null ? ((m.dir === "worse" ? -1 : 1) * (w1 - a)) / a : 0;
      let shape: string;
      if (signed < 0.08) shape = "minimal change";
      else if (signed < 0.3) shape = early > signed * 0.5 ? "modest early change" : "modest late change";
      else if (signed < 0.55) shape = early > signed * 0.45 ? "moderate, early" : "moderate, delayed";
      else shape = early > signed * 0.45 ? "substantial, rapid" : "substantial, delayed";
      return { measure: m, traj, relChange: signed, earlyShare: signed ? early / signed : 0, shape };
    });
    const convCounts = { low: 0, moderate: 0, high: 0 };
    members.forEach((p) => {
      // Only ever called with the synthetic cohort, which never produces
      // "unknown" -- only real participants (outside this module) do.
      convCounts[p.conventional as "low" | "moderate" | "high"]++;
    });
    const truth = PATTERNS.map((p) => members.filter((m2) => m2.pattern === p.id).length);
    out.push({
      c,
      label: "Cluster " + (c + 1),
      n: members.length,
      pct: (100 * members.length) / feat.keep.length,
      age: members.length ? mean(members.map((p) => p.age)) : 0,
      female: members.length ? (100 * members.filter((p) => p.sex === "F").length) / members.length : 0,
      bmi: members.length ? mean(members.map((p) => p.bmi)) : 0,
      duration: members.length ? median(members.map((p) => p.durationWeeks)) : 0,
      domains,
      convCounts,
      truth,
      members,
    });
  }
  return out;
}

// ── Early phenotype classification ─────────────────────────────────────────
export const EARLY_MODELS: EarlyModel[] = [
  { id: "m1", name: "Model 1", info: "Baseline only", upTo: 0 },
  { id: "m2", name: "Model 2", info: "Baseline + week 2", upTo: 1 },
  { id: "m3", name: "Model 3", info: "Baseline + week 2 + week 4", upTo: 2 },
];

function earlyMatrix(cohort: Cohort, keep: number[], upTo: number, enabled: MeasureId[] | null): { names: string[]; X: number[][] } {
  const use = enabled ? ACTIVE.filter((m) => enabled.includes(m.id)) : ACTIVE;
  const names: string[] = [];
  const rows: (number | null)[][] = [];
  use.forEach((m) => {
    for (let t = 0; t <= upTo; t++) names.push(m.name + " " + TIMEPOINTS[t].short);
  });
  if (upTo > 0) use.forEach((m) => names.push(m.name + " Δ BL→" + TIMEPOINTS[upTo].short));
  keep.forEach((i) => {
    const p = cohort.participants[i],
      row: (number | null)[] = [];
    use.forEach((m) => {
      for (let t = 0; t <= upTo; t++) {
        const o = p.obs[t];
        const v = o.missing ? null : o.values[m.id];
        row.push(valid(m.id, v) ? (v as number) : null);
      }
    });
    if (upTo > 0)
      use.forEach((m) => {
        const oa = p.obs[0],
          ob = p.obs[upTo];
        const a = oa.missing ? null : oa.values[m.id];
        const b = ob.missing ? null : ob.values[m.id];
        row.push(valid(m.id, a) && valid(m.id, b) ? (b as number) - (a as number) : null);
      });
    rows.push(row);
  });
  const cm = names.map((_, j) => mean(rows.map((r2) => r2[j]).filter((v): v is number => v !== null)));
  const filled = rows.map((r2) => r2.map((v, j) => (v === null ? cm[j] : v)));
  const mu = names.map((_, j) => mean(filled.map((r2) => r2[j])));
  const sg = names.map((_, j) => sd(filled.map((r2) => r2[j])) || 1);
  return { names, X: filled.map((r2) => r2.map((v, j) => (v - mu[j]) / sg[j])) };
}

function logreg(Xtr: number[][], ytr: number[], Xte: number[][], k: number): number[][] {
  const d = Xtr[0].length;
  const W: number[][] = Array.from({ length: k }, () => new Array(d + 1).fill(0));
  const lr = 0.35,
    lam = 0.02;
  for (let it = 0; it < 260; it++) {
    const G: number[][] = Array.from({ length: k }, () => new Array(d + 1).fill(0));
    Xtr.forEach((x, i) => {
      const z = W.map((w) => w[d] + x.reduce((s, v, j) => s + v * w[j], 0));
      const mx = Math.max(...z),
        e = z.map((v) => Math.exp(v - mx)),
        tot = e.reduce((a, b) => a + b, 0);
      e.forEach((v, c) => {
        const err = v / tot - (ytr[i] === c ? 1 : 0);
        for (let j = 0; j < d; j++) G[c][j] += err * x[j];
        G[c][d] += err;
      });
    });
    for (let c = 0; c < k; c++) for (let j = 0; j <= d; j++) W[c][j] -= lr * (G[c][j] / Xtr.length + (j < d ? lam * W[c][j] : 0));
  }
  return Xte.map((x) => {
    const z = W.map((w) => w[d] + x.reduce((s, v, j) => s + v * w[j], 0));
    const mx = Math.max(...z),
      e = z.map((v) => Math.exp(v - mx)),
      tot = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / tot);
  });
}

interface TreeLeaf {
  leaf: number[];
}
interface TreeSplit {
  j: number;
  thr: number;
  l: TreeNode;
  r: TreeNode;
}
type TreeNode = TreeLeaf | TreeSplit;

interface BestSplit {
  g: number;
  j: number;
  thr: number;
  li: number[];
  ri: number[];
}

function tree(X: number[][], y: number[], k: number, feats: number[], depth: number): TreeNode {
  const counts = new Array(k).fill(0);
  y.forEach((v) => counts[v]++);
  const probs = counts.map((c) => c / y.length);
  if (depth === 0 || y.length < 12 || Math.max(...probs) > 0.96) return { leaf: probs };
  let best: BestSplit | null = null;
  feats.forEach((j) => {
    const vals = X.map((x) => x[j]).sort((a, b) => a - b);
    for (let q = 1; q <= 3; q++) {
      const thr = vals[Math.floor((vals.length * q) / 4)];
      const li: number[] = [],
        ri: number[] = [];
      y.forEach((_, i) => (X[i][j] <= thr ? li : ri).push(i));
      if (li.length < 6 || ri.length < 6) continue;
      const gini = (idx: number[]) => {
        const c2 = new Array(k).fill(0);
        idx.forEach((i) => c2[y[i]]++);
        return 1 - c2.reduce((s, v) => s + (v / idx.length) ** 2, 0);
      };
      const g = (li.length * gini(li) + ri.length * gini(ri)) / y.length;
      if (!best || g < best.g) best = { g, j, thr, li, ri };
    }
  });
  if (!best) return { leaf: probs };
  const b: BestSplit = best;
  return {
    j: b.j,
    thr: b.thr,
    l: tree(b.li.map((i) => X[i]), b.li.map((i) => y[i]), k, feats, depth - 1),
    r: tree(b.ri.map((i) => X[i]), b.ri.map((i) => y[i]), k, feats, depth - 1),
  };
}
const treePred = (nd: TreeNode, x: number[]): number[] => ("leaf" in nd ? nd.leaf : treePred(x[nd.j] <= nd.thr ? nd.l : nd.r, x));

function forest(Xtr: number[][], ytr: number[], Xte: number[][], k: number, seed = 5): number[][] {
  const r = rng(seed),
    d = Xtr[0].length,
    trees: TreeNode[] = [];
  const mtry = Math.max(2, Math.round(Math.sqrt(d)));
  for (let t = 0; t < 40; t++) {
    const idx = Xtr.map(() => Math.floor(r() * Xtr.length));
    const feats: number[] = [];
    while (feats.length < mtry) {
      const j = Math.floor(r() * d);
      if (!feats.includes(j)) feats.push(j);
    }
    trees.push(tree(idx.map((i) => Xtr[i]), idx.map((i) => ytr[i]), k, feats, 5));
  }
  return Xte.map((x) => {
    const acc = new Array(k).fill(0);
    trees.forEach((t) => {
      treePred(t, x).forEach((p, c) => {
        acc[c] += p / trees.length;
      });
    });
    return acc;
  });
}

export const CLASSIFIERS: Classifier[] = [
  { id: "logreg", name: "Multinomial logistic regression", note: "L2 penalty λ=0.02, 260 epochs", run: logreg },
  { id: "rf", name: "Random forest", note: "40 trees, depth 5, √p features per split", run: forest },
  { id: "gbm", name: "Gradient boosting", note: "Adapter slot registered — not implemented in this sample", run: null },
];

export function runClassifier(
  cohort: Cohort,
  feat: Features,
  lab: number[],
  k: number,
  modelId: string,
  clfId: string,
  seed = 21,
  enabled: MeasureId[] | null = null
): ClassifierResult | null {
  const clf = CLASSIFIERS.find((c) => c.id === clfId);
  const model = EARLY_MODELS.find((m) => m.id === modelId);
  if (!clf || !clf.run || !model) return null;
  const { names, X } = earlyMatrix(cohort, feat.keep, model.upTo, enabled);
  const r = rng(seed);
  // Split by participant before any fitting — no observation from a test
  // participant is seen in training.
  const order = X.map((_, i) => i).sort(() => r() - 0.5);
  const byClass: Record<number, number[]> = {};
  order.forEach((i) => {
    (byClass[lab[i]] = byClass[lab[i]] || []).push(i);
  });
  const tr: number[] = [],
    te: number[] = [];
  Object.values(byClass).forEach((list) => {
    list.forEach((i, n2) => (n2 % 4 === 0 ? te : tr).push(i));
  });
  const P = clf.run(
    tr.map((i) => X[i]),
    tr.map((i) => lab[i]),
    te.map((i) => X[i]),
    k
  );
  const pred = P.map((p) => p.indexOf(Math.max(...p)));
  const cm: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  te.forEach((i, n2) => {
    cm[lab[i]][pred[n2]]++;
  });
  const perClass: PerClassMetric[] = [];
  for (let c = 0; c < k; c++) {
    const tp = cm[c][c],
      fn = cm[c].reduce((a, b) => a + b, 0) - tp;
    const fp = cm.reduce((a, row) => a + row[c], 0) - tp;
    const tn = te.length - tp - fn - fp;
    const prec = tp / (tp + fp || 1),
      rec = tp / (tp + fn || 1);
    perClass.push({ c, n: tp + fn, prec, rec, spec: tn / (tn + fp || 1), f1: (2 * prec * rec) / (prec + rec || 1) });
  }
  const correct = te.filter((i, n2) => pred[n2] === lab[i]).length;
  // 5-bin reliability curve for the top predicted probability.
  const bins: CalibrationBin[] = Array.from({ length: 5 }, (_, b) => ({ lo: 0.2 * b, hi: 0.2 * b + 0.2, n: 0, conf: 0, acc: 0 }));
  P.forEach((p, n2) => {
    const conf = Math.max(...p),
      b = Math.min(4, Math.floor(conf * 5));
    bins[b].n++;
    bins[b].conf += conf;
    bins[b].acc += pred[n2] === lab[te[n2]] ? 1 : 0;
  });
  bins.forEach((b) => {
    if (b.n) {
      b.conf /= b.n;
      b.acc /= b.n;
    }
  });
  return {
    nFeatures: names.length,
    nTrain: tr.length,
    nTest: te.length,
    cm,
    perClass,
    bins,
    accuracy: correct / te.length,
    balanced: mean(perClass.map((p) => p.rec)),
    macroF1: mean(perClass.map((p) => p.f1)),
    meanConfidence: mean(P.map((p) => Math.max(...p))),
    sampleCases: te.slice(0, 6).map((i, n2) => ({ sid: cohort.participants[feat.keep[i]].sid, pred: pred[n2] + 1, conf: Math.max(...P[n2]) })),
  };
}

export const CLUSTER_COLORS = ["#ec3013", "#201e1d", "#7d7979", "#ae1800", "#bab6b6", "#444141", "#ff9783", "#605d5d"];
