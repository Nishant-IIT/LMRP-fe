"use client";

import { useEffect, useRef, useState } from "react";
import type { ScreenId, MeasureId, Cohort, QualityReport, Features, ClusterMetrics, BootstrapResult, ClassifierResult } from "@/lib/types";
import { fmt, pct1 } from "@/lib/format";
import { download } from "@/lib/download";
import { InfoTipProvider } from "./InfoTip";
import { Nav } from "./Nav";
import { DashboardScreen } from "./screens/DashboardScreen";

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
  // Mirrors `this.state` from the original class component: business-logic
  // functions below read/write through this ref (via `patch`) so that a
  // setState-then-immediately-act sequence (e.g. "set cohort, then
  // recompute()") sees the fresh value synchronously, matching the
  // `this.setState(patch, callback)` semantics the original relied on.
  const stateRef = useRef(state);
  const engineRef = useRef<EngineModule | null>(null);

  function patch(update: Partial<PlatformState> | ((s: PlatformState) => Partial<PlatformState>)) {
    const next = typeof update === "function" ? update(stateRef.current) : update;
    stateRef.current = { ...stateRef.current, ...next };
    setState(stateRef.current);
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

  function recompute() {
    const E = engineRef.current;
    if (!E) return;
    patch({ busy: true });
    setTimeout(() => {
      const { featureSet, missing, enabled, algo, seed, cohort } = stateRef.current;
      if (!cohort) return;
      const feat = E.buildFeatures(cohort, featureSet, missing, enabled);
      const sweep: RunState["sweep"] = {};
      for (let k = 2; k <= 8; k++) {
        const lab = E.cluster(feat.Z, algo, k, seed);
        sweep[k] = lab ? { lab, m: E.metrics(feat.Z, lab, k) } : null;
      }
      patch({
        run: { feat, sweep, algo, featureSet, missing, seed, enabled, at: new Date() },
        busy: false,
        boot: null,
        sens: null,
        clfAll: {},
      });
      runClf();
    }, 20);
  }

  function runClf() {
    const E = engineRef.current;
    const { run } = stateRef.current;
    if (!E || !run) return;
    const { k, clfModel, clfAlgo, cohort } = stateRef.current;
    const key = [k, clfModel, clfAlgo, run.algo, run.featureSet, run.missing].join("|");
    if (stateRef.current.clfAll[key]) {
      patch({ clf: stateRef.current.clfAll[key] });
      return;
    }
    const cur = run.sweep[k];
    if (!cur || !cohort) return;
    setTimeout(() => {
      const r = E.runClassifier(cohort, run.feat, cur.lab, k, clfModel, clfAlgo, 21, run.enabled);
      patch((s) => ({ clf: r, clfAll: { ...s.clfAll, [key]: r! } }));
    }, 10);
  }

  function runBoot() {
    const E = engineRef.current;
    const { run, k } = stateRef.current;
    if (!E || !run || !run.sweep[k]) return;
    patch({ bootBusy: true });
    setTimeout(() => {
      const b = E.bootstrap(run.feat.Z, run.algo, k, Math.max(10, Math.min(200, stateRef.current.bootIters)), 99);
      patch({ boot: b, bootBusy: false });
    }, 30);
  }

  function runSensitivity() {
    const E = engineRef.current;
    const { run, k, cohort } = stateRef.current;
    if (!E || !run || !run.sweep[k] || !cohort) return;
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
        const feat = v.featureSet || v.missing ? E.buildFeatures(cohort, v.featureSet || run.featureSet, v.missing || run.missing, run.enabled) : run.feat;
        const lab = E.cluster(feat.Z, v.algo || run.algo, k, v.seed || run.seed);
        if (!lab) return;
        if (feat === run.feat) out.push({ label, ari: E.ari(base, lab) });
        else {
          const shared = feat.keep.filter((i) => run.feat.keep.includes(i));
          const a = shared.map((i) => base[run.feat.keep.indexOf(i)]);
          const b = shared.map((i) => lab[feat.keep.indexOf(i)]);
          out.push({ label, ari: E.ari(a, b) });
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
        engineRef.current = E;
        const cohort = E.makeCohort(300, stateRef.current.seed);
        const quality = E.qualityReport(cohort);
        patch({ ready: true, cohort, quality, engine: E });
        recompute();
      })
      .catch((e) => {
        if (!cancelled) patch({ err: String(e) });
      });
    return () => {
      cancelled = true;
    };
    // Mount-only: loads the engine once. recompute()/patch() read live state
    // via stateRef, so which render's closure runs here doesn't matter.
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
    case "enrol":
      screenBody = <div>Enrolment — TODO</div>;
      break;
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
