"use client";

import { useEffect, useState } from "react";
import type { ScreenId, MeasureId, Cohort, QualityReport, Features, ClusterMetrics, BootstrapResult, ClassifierResult } from "@/lib/types";
import { fmt, pct1 } from "@/lib/format";
import { download } from "@/lib/download";
import { InfoTipProvider } from "./InfoTip";
import { Nav } from "./Nav";
import { DashboardScreen } from "./screens/DashboardScreen";
import { EnrolmentScreen } from "./screens/EnrolmentScreen";

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
    case "participants":
      screenBody = <div>Participants — TODO</div>;
      break;
    case "entry":
      screenBody = <div>Assessment entry — TODO</div>;
      break;
    case "measures":
      screenBody = <div>Measures — TODO</div>;
      break;
    case "discovery":
      screenBody = <div>Discovery — TODO</div>;
      break;
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
