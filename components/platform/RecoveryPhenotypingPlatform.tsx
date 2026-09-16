"use client";

import { useEffect, useState } from "react";
import type { ScreenId, MeasureId, ToggleOpt, Cohort, QualityReport, Features, ClusterMetrics, BootstrapResult, ClassifierResult } from "@/lib/types";
import { fmt, pct1 } from "@/lib/format";
import { download } from "@/lib/download";
import { gx, gy, ticks, W, PL, PR, PB } from "@/lib/svg-chart";
import { InfoTipProvider } from "./InfoTip";
import { Nav } from "./Nav";
import { DashboardScreen } from "./screens/DashboardScreen";
import { EnrolmentScreen } from "./screens/EnrolmentScreen";
import { AssessmentEntryScreen } from "./screens/AssessmentEntryScreen";
import { MeasuresScreen } from "./screens/MeasuresScreen";
import { ParticipantsScreen, type RosterRow } from "./screens/ParticipantsScreen";
import type { TrajectoryPanelData } from "./charts/TrajectoryPanel";
import type { PopulationChartData } from "./charts/PopulationChart";
import { DiscoveryScreen } from "./screens/DiscoveryScreen";
import type { MetricLineChartData } from "./charts/MetricLineChart";
import type { HBarRow } from "./charts/HBarList";

type EngineModule = typeof import("@/lib/phenotype-engine");

export interface EnrolState {
  age: number;
  sex: "F" | "M";
  height: number;
  weight: number;
  duration: number;
  episodes: number;
  load: string;
  site: string;
  consent: boolean;
  inc: (boolean | null)[];
  exc: (boolean | null)[];
}

export interface EntryState {
  nprs: number;
  sts: number;
  odi: (number | null)[];
  fabq: (number | null)[];
}

export interface RunState {
  feat: Features;
  sweep: Record<number, { lab: number[]; m: ClusterMetrics } | null>;
  algo: string;
  featureSet: string;
  missing: string;
  seed: number;
  enabled: MeasureId[];
  at: Date;
}

export interface SolutionRecord {
  id: string;
  k: number;
  algo: string;
  algoName: string;
  seed: number;
  featureSet: string;
  nFeat: number;
  measures: string;
  missing: string;
  n: number;
  met: ClusterMetrics;
  stab: string | null;
  time: string;
}

interface PlatformState {
  ready: boolean;
  err: string | null;
  screen: ScreenId;
  recordOpen: boolean;
  busy: boolean;
  enabled: MeasureId[];
  selIdx: number;
  query: string;
  popDomain: MeasureId;
  popView: "individual" | "mean" | "both";
  algo: string;
  featureSet: string;
  missing: string;
  k: number;
  seed: number;
  run: RunState | null;
  solutions: SolutionRecord[];
  provisional: string | null;
  notes: Record<number, string>;
  boot: BootstrapResult | null;
  bootIters: number;
  bootBusy: boolean;
  sens: { label: string; ari: number }[] | null;
  sensBusy: boolean;
  clfModel: string;
  clfAlgo: string;
  clf: ClassifierResult | null;
  clfAll: Record<string, ClassifierResult>;
  enrol: EnrolState;
  entry: EntryState;
  cohort: Cohort | null;
  quality: QualityReport | null;
  // Held in state (not a ref) so the render body can read it directly —
  // reading a ref during render is disallowed. The imperative functions
  // below additionally keep engineRef for use outside render.
  engine: EngineModule | null;
}

const INCLUSION = [
  "Age 18 to 80 at enrolment",
  "Low back pain present for at least four weeks",
  "Able to attend twelve weeks of follow-up",
];
const EXCLUSION = [
  "Red flags suggesting serious spinal pathology",
  "Spinal surgery within the past twelve months",
  "Pregnancy",
];

const ENROL_DEFAULT: EnrolState = {
  age: 42,
  sex: "F",
  height: 168,
  weight: 74,
  duration: 9,
  episodes: 1,
  load: "Moderate",
  site: "Site A",
  consent: false,
  inc: [null, null, null],
  exc: [null, null, null],
};

const ENTRY_DEFAULT: EntryState = {
  nprs: 6,
  sts: 13.5,
  odi: [2, 3, 2, 1, 3, 2, null, 1, 2, 2],
  fabq: [3, 4, 2, 3],
};

const ODI_ITEMS = [
  "Pain intensity",
  "Personal care",
  "Lifting",
  "Walking",
  "Sitting",
  "Standing",
  "Sleeping",
  "Sex life",
  "Social life",
  "Travelling",
];
const FABQ_ITEMS = [
  "Physical activity makes my pain worse",
  "I should not do physical activities which might make my pain worse",
  "I cannot do physical activities which might make my pain worse",
  "Physical activity might harm my back",
];

function initialState(): PlatformState {
  return {
    ready: false,
    err: null,
    screen: "dashboard",
    recordOpen: false,
    busy: false,
    enabled: ["nprs", "odi", "sts", "fabq"],
    selIdx: 0,
    query: "",
    popDomain: "odi",
    popView: "both",
    algo: "kmeans",
    featureSet: "full",
    missing: "impute",
    k: 4,
    seed: 20260913,
    run: null,
    solutions: [],
    provisional: null,
    notes: {},
    boot: null,
    bootIters: 25,
    bootBusy: false,
    sens: null,
    sensBusy: false,
    clfModel: "m2",
    clfAlgo: "logreg",
    clf: null,
    clfAll: {},
    enrol: { ...ENROL_DEFAULT },
    entry: { ...ENTRY_DEFAULT },
    cohort: null,
    quality: null,
    engine: null,
  };
}

export function RecoveryPhenotypingPlatform() {
  const [state, setState] = useState<PlatformState>(initialState);

  // Plain functional setState — React guarantees the updater always sees the
  // latest state, even across consecutive calls in the same tick, so no ref
  // mirror is needed here (reading a ref during render is disallowed by
  // react-hooks/refs, and these setters are constructed inside render-time
  // view-model closures throughout every screen).
  function patch(update: Partial<PlatformState> | ((s: PlatformState) => Partial<PlatformState>)) {
    setState((s) => ({ ...s, ...(typeof update === "function" ? update(s) : update) }));
  }

  function set<K extends keyof PlatformState>(key: K, value: PlatformState[K]) {
    patch({ [key]: value } as Partial<PlatformState>);
  }

  function setEnrol(p: Partial<EnrolState>) {
    patch((s) => ({ enrol: { ...s.enrol, ...p } }));
  }

  function setEntry(p: Partial<EntryState>) {
    patch((s) => ({ entry: { ...s.entry, ...p } }));
  }

  // recompute/runClf/runBoot/runSensitivity take the engine/cohort/run they
  // need as explicit arguments rather than reading them back from `state`:
  // a caller that just changed e.g. `algo` via `set()` cannot rely on
  // `state.algo` reflecting that change yet (setState is async), so it
  // passes the new value straight through instead. Fields that are NOT
  // changing in the same action are read from `state` as closed over by
  // the current render, which is exactly "current as of the action that
  // triggered this call."
  function recompute(
    engine: EngineModule,
    cohort: Cohort,
    overrides?: { featureSet?: string; missing?: string; enabled?: MeasureId[]; algo?: string; seed?: number }
  ) {
    const featureSet = overrides?.featureSet ?? state.featureSet;
    const missing = overrides?.missing ?? state.missing;
    const enabled = overrides?.enabled ?? state.enabled;
    const algo = overrides?.algo ?? state.algo;
    const seed = overrides?.seed ?? state.seed;
    patch({ busy: true });
    setTimeout(() => {
      const feat = engine.buildFeatures(cohort, featureSet, missing, enabled);
      const sweep: RunState["sweep"] = {};
      for (let k = 2; k <= 8; k++) {
        const lab = engine.cluster(feat.Z, algo, k, seed);
        sweep[k] = lab ? { lab, m: engine.metrics(feat.Z, lab, k) } : null;
      }
      const run: RunState = { feat, sweep, algo, featureSet, missing, seed, enabled, at: new Date() };
      patch({ run, busy: false, boot: null, sens: null, clfAll: {} });
      runClf(engine, cohort, run);
    }, 20);
  }

  function runClf(engine: EngineModule, cohort: Cohort, run: RunState, overrides?: { k?: number; clfModel?: string; clfAlgo?: string }) {
    const k = overrides?.k ?? state.k;
    const clfModel = overrides?.clfModel ?? state.clfModel;
    const clfAlgo = overrides?.clfAlgo ?? state.clfAlgo;
    const key = [k, clfModel, clfAlgo, run.algo, run.featureSet, run.missing].join("|");
    const cached = state.clfAll[key];
    if (cached) {
      patch({ clf: cached });
      return;
    }
    const cur = run.sweep[k];
    if (!cur) return;
    setTimeout(() => {
      const r = engine.runClassifier(cohort, run.feat, cur.lab, k, clfModel, clfAlgo, 21, run.enabled);
      patch((s) => ({ clf: r, clfAll: { ...s.clfAll, [key]: r! } }));
    }, 10);
  }

  function runBoot() {
    const { engine, run, k, cohort, bootIters } = state;
    if (!engine || !run || !cohort || !run.sweep[k]) return;
    patch({ bootBusy: true });
    setTimeout(() => {
      const b = engine.bootstrap(run.feat.Z, run.algo, k, Math.max(10, Math.min(200, bootIters)), 99);
      patch({ boot: b, bootBusy: false });
    }, 30);
  }

  function runSensitivity() {
    const { engine, run, k, cohort } = state;
    if (!engine || !run || !cohort || !run.sweep[k]) return;
    patch({ sensBusy: true });
    setTimeout(() => {
      const base = run.sweep[k]!.lab;
      const out: { label: string; ari: number }[] = [];
      const variants: [string, { algo?: string; featureSet?: string; missing?: string; seed?: number }][] = [
        ["Alternative algorithm — Gaussian mixture", { algo: "gmm" }],
        ["Alternative algorithm — Hierarchical (Ward)", { algo: "hier" }],
        ["Alternative algorithm — K-means", { algo: "kmeans" }],
        ["Reduced features — baseline + total change", { featureSet: "base_change" }],
        ["Complete cases only", { missing: "complete" }],
        ["Different random seed (+1)", { seed: run.seed + 1 }],
      ];
      variants.forEach(([label, v]) => {
        if (v.algo === run.algo) return;
        if (v.featureSet === run.featureSet) return;
        if (v.missing === run.missing) return;
        const feat = v.featureSet || v.missing ? engine.buildFeatures(cohort, v.featureSet || run.featureSet, v.missing || run.missing, run.enabled) : run.feat;
        const lab = engine.cluster(feat.Z, v.algo || run.algo, k, v.seed || run.seed);
        if (!lab) return;
        if (feat === run.feat) out.push({ label, ari: engine.ari(base, lab) });
        else {
          const shared = feat.keep.filter((i) => run.feat.keep.includes(i));
          const a = shared.map((i) => base[run.feat.keep.indexOf(i)]);
          const b = shared.map((i) => lab[feat.keep.indexOf(i)]);
          out.push({ label, ari: engine.ari(a, b) });
        }
      });
      patch({ sens: out, sensBusy: false });
    }, 30);
  }

  useEffect(() => {
    let cancelled = false;
    import("@/lib/phenotype-engine")
      .then((E) => {
        if (cancelled) return;
        const cohort = E.makeCohort(300, state.seed);
        const quality = E.qualityReport(cohort);
        patch({ ready: true, cohort, quality, engine: E });
        recompute(E, cohort);
      })
      .catch((e) => {
        if (!cancelled) patch({ err: String(e) });
      });
    return () => {
      cancelled = true;
    };
    // Mount-only. `state.seed` closed over here is render #1's initial
    // value (20260913) — correct, since nothing can change it before mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.ready || !state.cohort || !state.quality || !state.engine) {
    return (
      <InfoTipProvider>
        <div style={{ padding: 24 }}>{state.err ? `Failed to load: ${state.err}` : "Loading…"}</div>
      </InfoTipProvider>
    );
  }

  // Derived values several screens share, recomputed from state each render
  // (mirrors the original renderVals()'s `const run = S.run, cur = ...`).
  const E = state.engine;
  const S = state;
  const run = S.run;
  const cur = run ? run.sweep[S.k] : null;
  const lab = cur ? cur.lab : null;
  const met = cur ? cur.m : null;
  const used = E.ACTIVE.filter((m) => S.enabled.includes(m.id));

  let screenBody: React.ReactNode;
  switch (state.screen) {
    case "dashboard": {
      const tpCards = E.TIMEPOINTS.map((tp, ti) => {
        const n = S.quality!.grid[ti].assessed;
        return { label: tp.label, n, pct: (100 * n) / S.cohort!.n, pctLabel: pct1((100 * n) / S.cohort!.n) };
      });
      const cw = 72,
        chh = 30,
        mx0 = 92,
        my0 = 30;
      const missCols = E.TIMEPOINTS.map((tp, i) => ({ label: tp.short, x: mx0 + cw * i + cw / 2, y: my0 - 12 }));
      const missRows = E.ACTIVE.map((m, r) => ({ label: m.name, y: my0 + chh * r + chh / 2 + 4 }));
      const missCells = E.ACTIVE.flatMap((m, rIdx) =>
        E.TIMEPOINTS.map((tp, i) => {
          const c = S.quality!.grid[i].byMeasure[m.id]!;
          const p = (100 * c.missing) / (c.missing + c.present);
          return {
            x: mx0 + cw * i,
            y: my0 + chh * rIdx,
            w: cw,
            h: chh,
            op: Math.min(0.92, 0.06 + p / 26),
            tx: mx0 + cw * i + cw / 2,
            ty: my0 + chh * rIdx + chh / 2 + 4,
            txt: p < 0.05 ? "0" : p.toFixed(1),
            ink: p > 12 ? "#f3f2f2" : "#201e1d",
          };
        })
      );
      const prov = S.solutions.find((x) => x.id === S.provisional);
      screenBody = (
        <DashboardScreen
          V={{
            tpCards,
            quality: {
              completeBaseline: S.quality!.completeBaseline,
              incompleteBaseline: S.quality!.incompleteBaseline,
              pMissLabel: pct1(S.quality!.participantMissingness.mean),
            },
            flags: S.quality!.flags,
            missGrid: {
              vb: `0 0 ${mx0 + cw * 6 + 4} ${my0 + chh * E.ACTIVE.length + 6}`,
              cols: missCols,
              rows: missRows,
              cells: missCells,
            },
            status: {
              algoName: E.ALGORITHMS.find((a) => a.id === S.algo)!.name,
              featureLine: `${run ? run.feat.names.length : 0} features · ${run ? run.feat.setName : ""}`,
              smallest: met ? `${met.smallest} (${met.smallestPct.toFixed(1)}%)` : "—",
              sil: met ? fmt(met.silhouette) : "—",
              db: met ? fmt(met.db) : "—",
              stability: S.boot ? fmt(S.boot.meanARI) : "not run",
              stabilityNote: S.boot ? `${S.boot.iters} bootstrap iterations` : "run it on the Profiles screen",
              clfAcc: S.clf ? pct1(100 * S.clf.balanced) : "—",
              clfNote: S.clf
                ? `balanced accuracy · ${E.EARLY_MODELS.find((m) => m.id === S.clfModel)!.info.toLowerCase()}`
                : "computing",
              provisional: prov ? prov.id : "none marked",
              provisionalNote: prov ? `K = ${prov.k} · ${prov.algoName}` : "researcher decision, not automatic",
            },
            k: S.k,
            onExportQuality: () => {
              const rows: (string | number)[][] = [["measure", "timepoint", "present", "missing", "pct_missing"]];
              E.ACTIVE.forEach((m) =>
                E.TIMEPOINTS.forEach((tp, i) => {
                  const c = S.quality!.grid[i].byMeasure[m.id]!;
                  rows.push([m.name, tp.id, c.present, c.missing, ((100 * c.missing) / (c.present + c.missing)).toFixed(2)]);
                })
              );
              download("data-quality-synthetic-v4.csv", rows.map((r) => r.join(",")).join("\n"));
            },
          }}
        />
      );
      break;
    }
    case "enrol": {
      const e = S.enrol;
      const n = S.cohort!.n;
      const bmi = e.height > 0 ? e.weight / Math.pow(e.height / 100, 2) : 0;
      const ageOk = e.age >= 18 && e.age <= 80;
      const incDone = e.inc.every((v) => v === true);
      const excClear = e.exc.every((v) => v === false);
      const answered = e.inc.every((v) => v !== null) && e.exc.every((v) => v !== null);
      const failed = e.inc.some((v) => v === false) || e.exc.some((v) => v === true);
      const eligible = incDone && excClear && ageOk;
      const base = new Date("2026-09-16T00:00:00Z");
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const opt2 = (list: string[], cur: string, setter: (v: string) => void) =>
        list.map((v) => ({ label: v, on: cur === v, go: () => setter(v) }));
      const yn = (arr: (boolean | null)[], i: number, key: "inc" | "exc") =>
        (
          [
            ["yes", true],
            ["no", false],
          ] as [string, boolean][]
        ).map(([label, val]) => ({
          label,
          on: arr[i] === val,
          go: () => {
            const next = arr.slice();
            next[i] = arr[i] === val ? null : val;
            setEnrol({ [key]: next });
          },
        }));
      const sid = "LBP-" + String(n + 1).padStart(4, "0");
      screenBody = (
        <EnrolmentScreen
          V={{
            sid,
            date: iso(base),
            age: e.age,
            height: e.height,
            weight: e.weight,
            duration: e.duration,
            episodes: e.episodes,
            bmi: bmi ? bmi.toFixed(1) : "—",
            durationLabel: e.duration + "w",
            durationClass: e.duration < 6 ? "acute" : e.duration < 12 ? "sub-acute" : "persistent",
            consent: e.consent,
            setAge: (ev) => setEnrol({ age: +ev.target.value || 0 }),
            setHeight: (ev) => setEnrol({ height: +ev.target.value || 0 }),
            setWeight: (ev) => setEnrol({ weight: +ev.target.value || 0 }),
            setDuration: (ev) => setEnrol({ duration: +ev.target.value || 0 }),
            setEpisodes: (ev) => setEnrol({ episodes: +ev.target.value || 0 }),
            toggleConsent: () => setEnrol({ consent: !e.consent }),
            sexOpts: opt2(["F", "M"], e.sex, (v) => setEnrol({ sex: v as "F" | "M" })),
            loadOpts: opt2(["Low", "Moderate", "High"], e.load, (v) => setEnrol({ load: v })),
            siteOpts: opt2(["Site A", "Site B", "Site C"], e.site, (v) => setEnrol({ site: v })),
            inclusion: INCLUSION.map((text, i) => ({ text, opts: yn(e.inc, i, "inc") })),
            exclusion: EXCLUSION.map((text, i) => ({ text, opts: yn(e.exc, i, "exc") })),
            status: !answered ? "Incomplete" : failed ? "Not eligible" : !ageOk ? "Not eligible" : "Eligible",
            statusNote: !answered
              ? "criteria not all recorded"
              : !ageOk
                ? "age outside 18–80"
                : failed
                  ? "screening record kept"
                  : "may proceed to baseline",
            statusBg: !answered ? "var(--color-surface)" : eligible ? "var(--color-surface)" : "var(--color-accent)",
            statusInk: !answered || eligible ? "var(--color-text)" : "var(--color-bg)",
            blocked: !(eligible && e.consent),
            actionNote: !eligible
              ? "Blocked until every criterion is recorded and met."
              : !e.consent
                ? "Blocked until consent is recorded."
                : "Enrolling is disabled in the sample.",
            schedule: E.TIMEPOINTS.map((tp, i) => {
              const d = new Date(base.getTime() + tp.week * 7 * 86400000);
              return {
                id: tp.id,
                label: tp.label,
                date: iso(d),
                window: i === 0 ? "on the day" : "±" + (tp.week <= 4 ? 3 : 7) + " days",
                status: i === 0 ? "due" : "scheduled",
              };
            }),
            payload:
              "study_id: " +
              sid +
              "\nenrolled: " +
              iso(base) +
              "\nsite: " +
              e.site +
              "\nconsent_version: v2.1\nconsent_recorded: " +
              (e.consent ? "true" : "false") +
              "\neligibility_inclusion: [" +
              e.inc.map((v) => (v === null ? "null" : v)).join(", ") +
              "]" +
              "\neligibility_exclusion: [" +
              e.exc.map((v) => (v === null ? "null" : v)).join(", ") +
              "]" +
              "\nage_years: " +
              e.age +
              "\nsex: " +
              e.sex +
              "\nheight_cm: " +
              e.height +
              "\nweight_kg: " +
              e.weight +
              "\nbmi: " +
              (bmi ? bmi.toFixed(1) : "null") +
              "  # derived" +
              "\nsymptom_duration_weeks: " +
              e.duration +
              "\nprior_episodes: " +
              e.episodes +
              "\noccupational_loading: " +
              e.load +
              "\nconventional_risk_group: null  # assigned after baseline scores exist" +
              "\nassessments: 0 of " +
              E.TIMEPOINTS.length,
            onEnrol: () => set("screen", "entry"),
            onReset: () => set("enrol", { ...ENROL_DEFAULT }),
          }}
        />
      );
      break;
    }
    case "participants": {
      const CC = E.CLUSTER_COLORS;
      const q = S.query.trim().toUpperCase();
      const matches = S.cohort!.participants.map((p, i) => ({ p, i })).filter((x) => !q || x.p.sid.includes(q));
      const listNote = `showing ${Math.min(60, matches.length)} of ${matches.length}`;
      const roster: RosterRow[] = matches.slice(0, 60).map(({ p, i }) => {
        const ci = run ? run.feat.keep.indexOf(i) : -1;
        return {
          sid: p.sid,
          sel: S.selIdx === i,
          go: () => set("selIdx", i),
          color: lab && ci > -1 ? CC[lab[ci]] : "var(--color-neutral-300)",
          dots: p.obs.map((o) => ({ fill: o.missing ? "var(--color-neutral-300)" : "var(--color-neutral-800)" })),
        };
      });
      const sp = S.cohort!.participants[S.selIdx];
      const spci = run ? run.feat.keep.indexOf(S.selIdx) : -1;
      const selVals = {
        sid: sp.sid,
        meta: `${sp.age}y · ${sp.sex} · BMI ${sp.bmi} · symptoms ${sp.durationWeeks}w · ${sp.episodes} prior episodes · ${sp.site}`,
        riskTag: `conventional risk: ${sp.conventional}`,
        clusterLabel: lab && spci > -1 ? `Cluster ${lab[spci] + 1}` : "not in current analysis set",
      };

      const measureSeries = (mid: MeasureId) =>
        E.TIMEPOINTS.map((tp, ti) => {
          const vals = S.cohort!.participants
            .map((p) => (p.obs[ti].missing ? null : p.obs[ti].values[mid]))
            .filter((v): v is number => E.valid(mid, v));
          return {
            mean: E.mean(vals),
            q1: E.quantile(vals, 0.25),
            q3: E.quantile(vals, 0.75),
            median: E.median(vals),
            n: vals.length,
            week: tp.week,
            short: tp.short,
          };
        });
      const domainRange = (mid: MeasureId): [number, number] => {
        const m = E.MEASURES.find((x) => x.id === mid)!;
        let lo = Infinity,
          hi = -Infinity;
        S.cohort!.participants.forEach((p) =>
          p.obs.forEach((o) => {
            const v = o.missing ? null : o.values[mid];
            if (!E.valid(mid, v)) return;
            lo = Math.min(lo, v!);
            hi = Math.max(hi, v!);
          })
        );
        const pad = (hi - lo) * 0.06;
        return [Math.max(m.min, Math.floor(lo - pad)), Math.min(m.max, Math.ceil(hi + pad))];
      };

      const panels: TrajectoryPanelData[] = used.map((m) => {
        const [lo, hi] = domainRange(m.id);
        const popS = measureSeries(m.id);
        const pw = 340,
          ph = 168,
          pl = 36;
        const gxp = (w: number) => gx(w, pw, pl, 10);
        const gyp = (v: number) => gy(v, lo, hi, ph);
        const segs: { points: string }[] = [];
        let curSeg: string[] = [];
        const dots: { x: number; y: number }[] = [];
        const gaps: { x: number; y: number }[] = [];
        E.TIMEPOINTS.forEach((tp, ti) => {
          const o = sp.obs[ti];
          const v = o.missing ? null : o.values[m.id];
          if (!E.valid(m.id, v)) {
            if (curSeg.length > 1) segs.push({ points: curSeg.join(" ") });
            curSeg = [];
            gaps.push({ x: gxp(tp.week) - 3.5, y: ph - PB - 4 });
            return;
          }
          curSeg.push(gxp(tp.week).toFixed(1) + "," + gyp(v!).toFixed(1));
          dots.push({ x: gxp(tp.week) - 3, y: gyp(v!) - 3 });
        });
        if (curSeg.length > 1) segs.push({ points: curSeg.join(" ") });
        const up = popS.map((s) => gxp(s.week).toFixed(1) + "," + gyp(s.q1).toFixed(1));
        const dn = popS.map((s) => gxp(s.week).toFixed(1) + "," + gyp(s.q3).toFixed(1)).reverse();
        return {
          domain: m.domain,
          name: m.name,
          unit: m.unit ? " " + m.unit : "",
          dirNote: m.dir === "worse" ? "higher = worse" : "higher = better",
          vb: `0 0 ${pw} ${ph}`,
          bandD: "M" + up.join(" L") + " L" + dn.join(" L") + " Z",
          popPoints: popS.map((s) => gxp(s.week).toFixed(1) + "," + gyp(s.mean).toFixed(1)).join(" "),
          segs,
          dots,
          gaps,
          yTicks: ticks(lo, hi, 3).map((t) => ({ y: gyp(t), x1: pl, x2: pw - 10, lx: pl - 5, ly: gyp(t) + 3, label: t.toFixed(t % 1 ? 1 : 0) })),
          xTicks: E.TIMEPOINTS.map((tp) => ({ x: gxp(tp.week), y: ph - 6, label: tp.short })),
        };
      });

      const popDomains: ToggleOpt[] = used.map((m) => ({ label: m.name, on: S.popDomain === m.id, go: () => set("popDomain", m.id) }));
      const popViews: ToggleOpt[] = (
        [
          ["individual", "Individuals"],
          ["mean", "Mean + CI"],
          ["both", "Both"],
        ] as ["individual" | "mean" | "both", string][]
      ).map(([id, name]) => ({ label: name, on: S.popView === id, go: () => set("popView", id) }));

      const pd = used.find((m) => m.id === S.popDomain) || used[0];
      const [plo, phi] = domainRange(pd.id);
      const popSFull = measureSeries(pd.id);
      const pgx = (w: number) => gx(w, W, PL, PR);
      const pgy = (v: number) => gy(v, plo, phi, 260);
      const showInd = S.popView !== "mean";
      const showMean = S.popView !== "individual";
      const spag = showInd
        ? S.cohort!.participants
            .filter((_, i) => i % 3 === 0)
            .map((p) => {
              const pts: string[] = [];
              E.TIMEPOINTS.forEach((tp, ti) => {
                const o = p.obs[ti];
                const v = o.missing ? null : o.values[pd.id];
                if (!E.valid(pd.id, v)) return;
                pts.push(pgx(tp.week).toFixed(1) + "," + pgy(v!).toFixed(1));
              });
              const ci = run ? run.feat.keep.indexOf(S.cohort!.participants.indexOf(p)) : -1;
              return { points: pts.join(" "), color: lab && ci > -1 ? CC[lab[ci]] : "#7d7979" };
            })
            .filter((s) => s.points)
        : [];
      const ciUp = popSFull.map((s) => pgx(s.week).toFixed(1) + "," + pgy(s.mean + (1.96 * (s.q3 - s.q1)) / (1.349 * Math.sqrt(s.n))).toFixed(1));
      const ciDn = popSFull
        .map((s) => pgx(s.week).toFixed(1) + "," + pgy(s.mean - (1.96 * (s.q3 - s.q1)) / (1.349 * Math.sqrt(s.n))).toFixed(1))
        .reverse();
      const pop: PopulationChartData = {
        vb: `0 0 ${W} 260`,
        spaghetti: spag,
        bandOp: showMean ? 0.22 : 0,
        bandD: showMean ? "M" + ciUp.join(" L") + " L" + ciDn.join(" L") + " Z" : "",
        meanPoints: showMean ? popSFull.map((s) => pgx(s.week).toFixed(1) + "," + pgy(s.mean).toFixed(1)).join(" ") : "",
        medianPoints: showMean ? popSFull.map((s) => pgx(s.week).toFixed(1) + "," + pgy(s.median).toFixed(1)).join(" ") : "",
        meanW: 3,
        medW: 2,
        yTicks: ticks(plo, phi, 4).map((t) => ({ y: pgy(t), x1: PL, x2: W - PR, lx: PL - 6, ly: pgy(t) + 3, label: t.toFixed(t % 1 ? 1 : 0) })),
        xTicks: E.TIMEPOINTS.map((tp) => ({ x: pgx(tp.week), y: 252, label: tp.short })),
        ns: E.TIMEPOINTS.map((tp, i) => ({ x: pgx(tp.week), y: 240, label: "n=" + popSFull[i].n })),
        caption:
          pd.full +
          " (" +
          pd.name +
          "), " +
          (pd.dir === "worse" ? "higher = worse" : "higher = better") +
          ". " +
          (showInd ? "Every third participant is drawn, coloured by current cluster. " : "") +
          (showMean ? "Red: mean with 95% confidence band. Dashed: median." : "Averages hidden — individual variation only."),
      };

      screenBody = (
        <ParticipantsScreen
          V={{
            listNote,
            roster,
            query: S.query,
            setQuery: (ev) => set("query", ev.target.value),
            sel: selVals,
            panels,
            popDomains,
            popViews,
            pop,
          }}
        />
      );
      break;
    }
    case "entry": {
      const e = S.entry;
      const answered = e.odi.filter((v): v is number => v !== null);
      const raw = answered.reduce((a, b) => a + b, 0);
      const missing = 10 - answered.length;
      const pct = answered.length ? (100 * raw) / (5 * answered.length) : 0;
      const validOdi = missing <= 2;
      const fabqScore = e.fabq.reduce<number>((a, b) => a + (b === null ? 0 : b), 0);
      screenBody = (
        <AssessmentEntryScreen
          V={{
            sid: "LBP-0142",
            tpLabel: "T2 — week 4",
            nprs: e.nprs,
            sts: e.sts.toFixed(1),
            fabqScore,
            odiRaw: raw,
            odiMax: 5 * answered.length,
            odiPct: pct.toFixed(1),
            odiMissing: missing,
            status: validOdi ? "Valid" : "Invalid",
            statusNote: validOdi
              ? missing
                ? `pro-rated over ${answered.length} sections`
                : "all sections answered"
              : "more than 2 sections missing",
            statusBg: validOdi ? "var(--color-surface)" : "var(--color-accent)",
            statusInk: validOdi ? "var(--color-text)" : "var(--color-bg)",
            odiItems: ODI_ITEMS.map((text, i) => ({
              text: `${i + 1}. ${text}`,
              opts: ([0, 1, 2, 3, 4, 5, null] as (number | null)[]).map((v) => ({
                label: v === null ? "—" : String(v),
                on: e.odi[i] === v,
                go: () => {
                  const next = e.odi.slice();
                  next[i] = v;
                  setEntry({ odi: next });
                },
              })),
            })),
            fabqItems: FABQ_ITEMS.map((text, i) => ({
              text: `${i + 1}. ${text}`,
              opts: [0, 1, 2, 3, 4, 5, 6].map((v) => ({
                label: String(v),
                on: e.fabq[i] === v,
                go: () => {
                  const next = e.fabq.slice();
                  next[i] = v;
                  setEntry({ fabq: next });
                },
              })),
            })),
            payload:
              "study_id: LBP-0142\ntimepoint: T2\nnprs_items: [" +
              e.nprs +
              "]\nodi_items: [" +
              e.odi.map((v) => (v === null ? "null" : v)).join(", ") +
              "]\nodi_raw: " +
              raw +
              "\nodi_index: " +
              pct.toFixed(1) +
              "\nodi_missing_items: " +
              missing +
              "\nodi_status: " +
              (validOdi ? "valid" : "invalid") +
              "\nsts_seconds: " +
              e.sts.toFixed(1) +
              "\nfabq_items: [" +
              e.fabq.join(", ") +
              "]\nfabq_raw: " +
              fabqScore +
              "\ncompleteness: " +
              ((100 * (answered.length + 1 + 1 + e.fabq.filter((v) => v !== null).length)) / 16).toFixed(0) +
              "%",
            setNprs: (ev) => setEntry({ nprs: +ev.target.value }),
            setSts: (ev) => setEntry({ sts: +ev.target.value }),
            onReset: () => set("entry", { ...ENTRY_DEFAULT }),
          }}
        />
      );
      break;
    }
    case "measures": {
      const measureRows = E.MEASURES.map((m) => {
        const hasData = E.ACTIVE.some((a) => a.id === m.id);
        const on = S.enabled.includes(m.id);
        return {
          name: m.name,
          full: m.full,
          domain: m.domain,
          range: `${m.min}–${m.max}${m.unit ? " " + m.unit : ""}`,
          items: m.items,
          dirOpts: (
            [
              ["worse", "higher = worse"],
              ["better", "higher = better"],
            ] as ["worse" | "better", string][]
          ).map(([v, label]) => ({
            label,
            group: "dir-" + m.id,
            on: m.dir === v,
            go: () => {
              m.dir = v;
              recompute(E, S.cohort!);
            },
          })),
          lock: !hasData || (on && S.enabled.length < 2),
          stateLabel: !hasData ? "no data yet" : on ? "remove" : "add",
          stateNote: !hasData ? "configured, not collected" : on ? "in analysis" : "excluded",
          toggle: () => {
            if (!hasData) return;
            const next = on ? S.enabled.filter((x) => x !== m.id) : S.enabled.concat([m.id]);
            if (next.length < 2) return;
            set("enabled", next);
            recompute(E, S.cohort!, { enabled: next });
          },
        };
      });
      const alignCards = E.ACTIVE.map((m) => ({
        name: m.name,
        raw: m.dir === "worse" ? "raw: higher = worse" : "raw: higher = better",
        transform: (m.dir === "worse" ? "× −1" : "× +1") + " then z-score",
      }));
      const tpRows = E.TIMEPOINTS.map((tp, i) => ({
        id: tp.id,
        label: tp.label,
        week: tp.week,
        window: i === 0 ? "—" : "±" + (tp.week <= 4 ? 3 : 7) + " days",
        n: S.quality!.grid[i].assessed,
      }));
      screenBody = <MeasuresScreen V={{ measureRows, alignCards, tpRows }} />;
      break;
    }
    case "discovery": {
      const featureSetOpts: ToggleOpt[] = E.FEATURE_SETS.map((f) => ({
        label: f.name,
        on: S.featureSet === f.id,
        go: () => {
          set("featureSet", f.id);
          recompute(E, S.cohort!, { featureSet: f.id });
        },
      }));
      const algoOpts = E.ALGORITHMS.map((a) => ({
        label: a.name + (a.run ? "" : " — adapter slot, not implemented"),
        dis: !a.run,
        op: a.run ? 1 : 0.45,
        on: S.algo === a.id,
        go: () => {
          set("algo", a.id);
          recompute(E, S.cohort!, { algo: a.id });
        },
      }));
      const missingOpts: ToggleOpt[] = (
        [
          ["impute", "Mean imputation on derived features"],
          ["complete", "Complete cases only"],
        ] as [string, string][]
      ).map(([id, name]) => ({
        label: name,
        on: S.missing === id,
        go: () => {
          set("missing", id);
          recompute(E, S.cohort!, { missing: id });
        },
      }));
      const algoNote = E.ALGORITHMS.find((a) => a.id === S.algo)!.note;
      const featCount = run ? `${run.feat.names.length} features from ${used.length} measures` : "building…";
      const missingNote = run
        ? S.missing === "complete"
          ? `${run.feat.nDropped} participants dropped`
          : "column means on standardised features"
        : "";
      const busyNote = S.busy ? "recomputing…" : "partition is reproducible from this seed";

      const mdefs: [string, (m: ClusterMetrics) => number, number, string, string][] = [
        ["Silhouette", (m) => m.silhouette, 2, "higher is better · −1 to 1", "silhouette"],
        ["Calinski–Harabasz", (m) => m.ch, 0, "higher is better", "ch"],
        ["Davies–Bouldin", (m) => m.db, 2, "lower is better", "db"],
        ["Within-cluster SS", (m) => m.wss, 0, "always falls as K rises", "wss"],
      ];
      const metricCharts: MetricLineChartData[] = mdefs.map(([title, get, dp, hint, gkey]) => {
        const ks = [2, 3, 4, 5, 6, 7, 8].filter((k2) => run && run.sweep[k2]);
        const vals = ks.map((k2) => get(run!.sweep[k2]!.m));
        const lo = Math.min(...vals),
          hi = Math.max(...vals);
        const cw2 = 250,
          ch2 = 150,
          pl2 = 42;
        const gxm = (i: number) => pl2 + (i / 6) * (cw2 - pl2 - 10);
        const gym = (v: number) => 12 + (1 - (v - lo) / (hi - lo || 1)) * (ch2 - 12 - 24);
        return {
          title,
          hint,
          infoId: gkey as MetricLineChartData["infoId"],
          vb: `0 0 ${cw2} ${ch2}`,
          selLabel: run && run.sweep[S.k] ? fmt(get(run.sweep[S.k]!.m), dp) : "—",
          points: ks.map((k2, i) => gxm(k2 - 2).toFixed(1) + "," + gym(vals[i]).toFixed(1)).join(" "),
          dots: ks.map((k2, i) => ({
            x: gxm(k2 - 2) - (k2 === S.k ? 4 : 2.5),
            y: gym(vals[i]) - (k2 === S.k ? 4 : 2.5),
            s: k2 === S.k ? 8 : 5,
            fill: k2 === S.k ? "#ec3013" : "#201e1d",
          })),
          yTicks: [lo, (lo + hi) / 2, hi].map((t) => ({
            y: gym(t),
            x1: pl2,
            x2: cw2 - 10,
            lx: pl2 - 5,
            ly: gym(t) + 3,
            label: Math.abs(t) > 999 ? (t / 1000).toFixed(1) + "k" : t.toFixed(dp),
          })),
          xTicks: ks.map((k2) => ({ x: gxm(k2 - 2), y: ch2 - 8, label: String(k2), ink: k2 === S.k ? "#ec3013" : "currentColor" })),
        };
      });

      const sizeBars: HBarRow[] = met
        ? met.sizes.map((n, c) => ({
            label: "Cluster " + (c + 1),
            color: E.CLUSTER_COLORS[c],
            pct: (100 * n) / Math.max(...met!.sizes),
            value: n + " · " + ((100 * n) / run!.feat.keep.length).toFixed(1) + "%",
          }))
        : [];
      const sizeNote = met
        ? `Smallest cluster holds ${met.smallest} participants (${met.smallestPct.toFixed(1)}% of ${run!.feat.keep.length} analysed). A cluster under about 5% is usually too small to profile.`
        : "";
      const featChips = run ? run.feat.names.map((n) => ({ name: n })) : [];

      screenBody = (
        <DiscoveryScreen
          V={{
            featureSetOpts,
            featCount,
            algoOpts,
            algoNote,
            missingOpts,
            missingNote,
            k: S.k,
            setK: (ev) => {
              const k = +ev.target.value;
              patch({ k, boot: null, sens: null });
              if (run) runClf(E, S.cohort!, run, { k });
            },
            seed: S.seed,
            setSeed: (ev) => {
              const seed = +ev.target.value || 1;
              set("seed", seed);
              recompute(E, S.cohort!, { seed });
            },
            busyNote,
            metricCharts,
            sizeBars,
            sizeNote,
            featChips,
            onAddSolution: () => {
              if (!met || !run) return;
              const id = "RUN-" + String(S.solutions.length + 1).padStart(3, "0");
              const rec: SolutionRecord = {
                id,
                k: S.k,
                algo: run.algo,
                algoName: E.ALGORITHMS.find((a) => a.id === run.algo)!.name,
                seed: run.seed,
                featureSet: run.feat.setName,
                nFeat: run.feat.names.length,
                measures: used.map((m) => m.name).join(" · "),
                missing: run.missing === "complete" ? "complete cases" : "mean imputation",
                n: run.feat.keep.length,
                met,
                stab: S.boot ? fmt(S.boot.meanARI) : null,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              };
              patch((s) => ({ solutions: s.solutions.concat([rec]), screen: "solutions" }));
            },
            onExportFeatures: () => {
              if (!run) return;
              const rows: (string | number)[][] = [["study_id", "cluster"].concat(run.feat.names.map((n) => n.replace(/[ →]+/g, "_")))];
              run.feat.keep.forEach((i, r) =>
                rows.push(([S.cohort!.participants[i].sid, lab ? lab[r] + 1 : ""] as (string | number)[]).concat(run.feat.Z[r].map((v) => v.toFixed(4))))
              );
              download(`features-k${S.k}-${run.algo}.csv`, rows.map((r) => r.join(",")).join("\n"));
            },
          }}
        />
      );
      break;
    }
    case "solutions":
      screenBody = <div>Solutions — TODO</div>;
      break;
    case "profiles":
      screenBody = <div>Profiles — TODO</div>;
      break;
    case "classify":
      screenBody = <div>Classification — TODO</div>;
      break;
  }

  return (
    <InfoTipProvider>
      <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
        <Nav
          screen={state.screen}
          onNavigate={(s) => set("screen", s)}
          onOpenRecord={() => set("recordOpen", true)}
          datasetVersion="synthetic-v4"
          seed={state.seed}
        />
        <main style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 16px 72px" }}>{screenBody}</main>
        {state.recordOpen && (
          <div className="dialog-backdrop" style={{ alignItems: "stretch", justifyContent: "flex-end", padding: 0 }}>
            <div
              style={{
                width: "min(560px, 100%)",
                background: "var(--color-bg)",
                boxShadow: "var(--shadow-lg)",
                overflow: "auto",
                padding: 24,
                borderLeft: "2px solid var(--color-divider)",
              }}
            >
              <button className="btn btn-secondary" type="button" onClick={() => set("recordOpen", false)}>
                Close
              </button>
              <p>Analysis record — TODO</p>
            </div>
          </div>
        )}
      </div>
    </InfoTipProvider>
  );
}
