"use client";

import { useEffect, useState } from "react";
import type { ScreenId, MeasureId, ToggleOpt, SaveStatus, Cohort, Measure, QualityReport, Features, ClusterMetrics, BootstrapResult, ClassifierResult } from "@/lib/types";
import { fmt, pct1 } from "@/lib/format";
import { download } from "@/lib/download";
import { gx, gy, ticks, W, PL, PR, PB } from "@/lib/svg-chart";
import { enrollParticipant, submitAssessment, updateParticipant } from "@/lib/api";
import { fetchRealCohort, fetchMeasures, fetchRealParticipants, fetchParticipantDetail, updateMeasure } from "@/lib/real-data";
import { InfoTipProvider } from "./InfoTip";
import { Nav } from "./Nav";
import { AnalysisRecordDrawer } from "./AnalysisRecordDrawer";
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
import { SolutionsScreen } from "./screens/SolutionsScreen";
import { ProfilesScreen, type ClusterCard, type BootVals } from "./screens/ProfilesScreen";
import type { ClusterTrajectoryLine } from "./charts/ClusterTrajectoryChart";
import { ClassificationScreen, type ModelOpt } from "./screens/ClassificationScreen";
import type { ConfusionMatrixData } from "./charts/ConfusionMatrix";
import type { CalibrationCurveData } from "./charts/CalibrationCurve";

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

const SAVE_IDLE: SaveStatus = { kind: "idle", message: "" };

// Screens still driven by the synthetic in-browser cohort -- the only ones
// that still show the "SYNTHETIC DATA MODE" banner. Dashboard, Participants,
// and Measures now read real backend data; Enrolment and Assessment Entry
// already did.
const SYNTHETIC_SCREENS = new Set<ScreenId>(["discovery", "solutions", "profiles", "classify"]);

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
  // The real participant created by the enroll API call, if any -- distinct
  // from the synthetic `cohort`, which stays untouched. Pre-selects
  // `selectedParticipantId` on Assessment Entry, and while set the
  // Enrolment screen shows a post-save confirmation (real sid/date/schedule)
  // instead of the editable pre-save form.
  enrolledParticipant: { id: number; sid: string; enrolledAt: string } | null;
  enrolSave: SaveStatus;
  entrySave: SaveStatus;
  // Assessment Entry: full participant list (for the picker) plus which
  // participant/timepoint is currently selected. Any enrolled participant
  // and any of the backend's six real timepoints (T0/W2/W4/W8/W12/W24) can
  // be chosen, not just the one just enrolled.
  entryParticipants: { id: number; sid: string }[] | null;
  entryParticipantsLoading: boolean;
  entryParticipantsError: string | null;
  selectedParticipantId: number | null;
  selectedTimepointId: string;
  // Enrolment screen's edit mode -- set while correcting an already-saved
  // participant's record (distinct from enrolledParticipant, which tracks
  // the "just enrolled, confirmation shown" case for a brand-new one).
  editingParticipant: { id: number; sid: string; enrolledAt: string } | null;
  editLoading: boolean;
  editError: string | null;
  editSave: SaveStatus;
  // Real data for Dashboard/Participants/Measures, fetched from the backend
  // (kept separate from the synthetic `cohort` below, which still backs
  // Discovery/Solutions/Profiles/Classification until the analysis engine
  // exists).
  realCohort: Cohort | null;
  realQuality: QualityReport | null;
  realLoading: boolean;
  realError: string | null;
  realMeasures: Measure[] | null;
  measuresLoading: boolean;
  measuresError: string | null;
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

// The backend's real assessment schedule (supabase/migrations/..._measures_and_timepoints.sql),
// distinct from the frontend's synthetic TIMEPOINTS (T0..T5 at weeks 0-12) --
// submit-assessment only accepts these six ids, and the Enrolment screen's
// visit-schedule table is generated from weekOffset/windowDays below to
// match the real schedule a researcher can hand to the patient.
const REAL_TIMEPOINTS: { id: string; label: string; weekOffset: number; windowDays: number }[] = [
  { id: "T0", label: "Baseline", weekOffset: 0, windowDays: 3 },
  { id: "W2", label: "Week 2", weekOffset: 2, windowDays: 3 },
  { id: "W4", label: "Week 4", weekOffset: 4, windowDays: 3 },
  { id: "W8", label: "Week 8", weekOffset: 8, windowDays: 7 },
  { id: "W12", label: "Week 12", weekOffset: 12, windowDays: 7 },
  { id: "W24", label: "Week 24", weekOffset: 24, windowDays: 7 },
];

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
    enrolledParticipant: null,
    enrolSave: SAVE_IDLE,
    entrySave: SAVE_IDLE,
    entryParticipants: null,
    entryParticipantsLoading: false,
    entryParticipantsError: null,
    selectedParticipantId: null,
    selectedTimepointId: "T0",
    editingParticipant: null,
    editLoading: false,
    editError: null,
    editSave: SAVE_IDLE,
    realCohort: null,
    realQuality: null,
    realLoading: false,
    realError: null,
    realMeasures: null,
    measuresLoading: false,
    measuresError: null,
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

  // Reads `state.enrol` as closed over by the render that created this
  // handler -- current as of the click that triggered it, same convention
  // as the view-model builders below.
  async function enrolAndSave() {
    const e = state.enrol;
    patch({ enrolSave: { kind: "saving", message: "Saving…" } });
    try {
      const result = await enrollParticipant({
        age: e.age,
        sex: e.sex,
        height_cm: e.height,
        weight_kg: e.weight,
        duration_weeks: e.duration,
        episodes: e.episodes,
        occupational_load: e.load.toLowerCase() as "low" | "moderate" | "high",
        site: e.site,
        consent: e.consent,
        inclusion: e.inc.map((v) => v === true),
        exclusion: e.exc.map((v) => v === true),
      });
      patch({
        enrolledParticipant: { id: result.participant.id, sid: result.participant.sid, enrolledAt: result.participant.enrolled_at },
        selectedParticipantId: result.participant.id,
        selectedTimepointId: "T0",
        enrolSave: { kind: "success", message: `Saved as ${result.participant.sid}.` },
      });
    } catch (err) {
      patch({ enrolSave: { kind: "error", message: err instanceof Error ? err.message : "Enrol failed." } });
    }
  }

  // Leaves the just-saved confirmation (shown on the Enrolment screen) and
  // moves on to collect the baseline assessment -- previously automatic on
  // save, which meant the confirmation was never actually seen.
  function continueToAssessment() {
    patch({ screen: "entry" });
  }

  // Clears the confirmation so the Enrolment screen goes back to an
  // editable, blank form for the next participant.
  function enrolAnother() {
    set("enrol", { ...ENROL_DEFAULT });
    patch({ enrolledParticipant: null, enrolSave: SAVE_IDLE });
  }

  const LOAD_LABEL: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High" };

  // Loads an already-saved participant's record into the Enrolment form for
  // correction, navigating there. Keyed by the real numeric id (not sid) --
  // callers get it from entryParticipants, the same {id,sid} list Assessment
  // Entry's picker uses.
  async function startEditingParticipant(id: number) {
    patch({ screen: "enrol", editLoading: true, editError: null, editingParticipant: null, editSave: SAVE_IDLE });
    try {
      const d = await fetchParticipantDetail(id);
      setEnrol({
        age: d.age,
        sex: d.sex,
        height: d.height_cm,
        weight: d.weight_kg,
        duration: d.duration_weeks,
        episodes: d.episodes,
        load: LOAD_LABEL[d.occupational_load] ?? d.occupational_load,
        site: d.site,
        consent: d.consent,
        inc: d.inclusion_answers,
        exc: d.exclusion_answers,
      });
      patch({ editingParticipant: { id: d.id, sid: d.sid, enrolledAt: d.enrolled_at }, editLoading: false });
    } catch (err) {
      patch({ editError: err instanceof Error ? err.message : "Failed to load participant", editLoading: false });
    }
  }

  async function saveParticipantEdit() {
    const target = state.editingParticipant;
    if (!target) return;
    const e = state.enrol;
    patch({ editSave: { kind: "saving", message: "Saving…" } });
    try {
      await updateParticipant({
        participant_id: target.id,
        age: e.age,
        sex: e.sex,
        height_cm: e.height,
        weight_kg: e.weight,
        duration_weeks: e.duration,
        episodes: e.episodes,
        occupational_load: e.load.toLowerCase() as "low" | "moderate" | "high",
        site: e.site,
        consent: e.consent,
        inclusion: e.inc.map((v) => v === true),
        exclusion: e.exc.map((v) => v === true),
      });
      patch({ editSave: { kind: "success", message: "Changes saved." } });
    } catch (err) {
      patch({ editSave: { kind: "error", message: err instanceof Error ? err.message : "Save failed." } });
    }
  }

  // Leaves edit mode without navigating -- the caller (the "Back to
  // Participants" button) handles navigation itself.
  function cancelEditingParticipant() {
    set("enrol", { ...ENROL_DEFAULT });
    patch({ editingParticipant: null, editError: null, editSave: SAVE_IDLE, screen: "participants" });
  }

  async function saveAssessment() {
    const participantId = state.selectedParticipantId;
    if (!participantId) {
      patch({ entrySave: { kind: "error", message: "Select a participant first." } });
      return;
    }
    const e = state.entry;
    patch({ entrySave: { kind: "saving", message: "Saving…" } });
    try {
      const result = await submitAssessment({
        participant_id: participantId,
        timepoint_id: state.selectedTimepointId,
        nprs: e.nprs,
        sts: e.sts,
        odi_items: e.odi,
        fabq_items: e.fabq,
      });
      patch({
        entrySave: {
          kind: "success",
          message: result.valid ? "Assessment saved." : "Saved, but flagged invalid (too many missing items).",
        },
      });
    } catch (err) {
      patch({ entrySave: { kind: "error", message: err instanceof Error ? err.message : "Save failed." } });
    }
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

  // Refetch real backend data every time Dashboard or Participants is
  // navigated to, so a just-enrolled participant shows up without a full
  // page reload (per design: refetch on navigation, not cached).
  useEffect(() => {
    if (state.screen !== "dashboard" && state.screen !== "participants" && state.screen !== "measures") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      patch({ realLoading: true, realError: null });
      Promise.all([fetchRealCohort(), import("@/lib/phenotype-engine")])
        .then(([cohort, E]) => {
          if (cancelled) return;
          const quality = E.qualityReport(cohort);
          patch({ realCohort: cohort, realQuality: quality, realLoading: false });
        })
        .catch((err) => {
          if (!cancelled) patch({ realError: err instanceof Error ? err.message : "Failed to load real data", realLoading: false });
        });
    });
    return () => {
      cancelled = true;
    };
  }, [state.screen]);

  // Same for Measures -- also needed by Participants, which uses the real
  // active-measure list to decide which trajectory panels to render.
  useEffect(() => {
    if (state.screen !== "measures" && state.screen !== "participants") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      patch({ measuresLoading: true, measuresError: null });
      fetchMeasures()
        .then((measures) => {
          if (!cancelled) patch({ realMeasures: measures, measuresLoading: false });
        })
        .catch((err) => {
          if (!cancelled) patch({ measuresError: err instanceof Error ? err.message : "Failed to load measures", measuresLoading: false });
        });
    });
    return () => {
      cancelled = true;
    };
  }, [state.screen]);

  // Participant list for the Assessment Entry picker, refetched on
  // navigation so a just-enrolled participant appears without a reload.
  useEffect(() => {
    // Also fetched for Participants -- its Edit action needs the real
    // numeric id, which fetchRealCohort()'s reshaped Participant (shared
    // with the synthetic-data screens) doesn't carry, only sid.
    if (state.screen !== "entry" && state.screen !== "participants") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      patch({ entryParticipantsLoading: true, entryParticipantsError: null });
      fetchRealParticipants()
        .then((participants) => {
          if (!cancelled) patch({ entryParticipants: participants, entryParticipantsLoading: false });
        })
        .catch((err) => {
          if (!cancelled)
            patch({ entryParticipantsError: err instanceof Error ? err.message : "Failed to load participants", entryParticipantsLoading: false });
        });
    });
    return () => {
      cancelled = true;
    };
  }, [state.screen]);

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
  const prov = S.solutions.find((x) => x.id === S.provisional);

  // Export functions — shared between the screen that surfaces each one
  // inline (Dashboard/Discovery) and the analysis-record drawer, which can
  // be opened from any screen.
  const exportQuality = () => {
    const rows: (string | number)[][] = [["measure", "timepoint", "present", "missing", "pct_missing"]];
    E.ACTIVE.forEach((m) =>
      E.TIMEPOINTS.forEach((tp, i) => {
        const c = S.quality!.grid[i].byMeasure[m.id]!;
        rows.push([m.name, tp.id, c.present, c.missing, ((100 * c.missing) / (c.present + c.missing)).toFixed(2)]);
      })
    );
    download("data-quality-synthetic-v4.csv", rows.map((r) => r.join(",")).join("\n"));
  };
  const exportFeatures = () => {
    if (!run) return;
    const rows: (string | number)[][] = [["study_id", "cluster"].concat(run.feat.names.map((n) => n.replace(/[ →]+/g, "_")))];
    run.feat.keep.forEach((i, r) =>
      rows.push(([S.cohort!.participants[i].sid, lab ? lab[r] + 1 : ""] as (string | number)[]).concat(run.feat.Z[r].map((v) => v.toFixed(4))))
    );
    download(`features-k${S.k}-${run.algo}.csv`, rows.map((r) => r.join(",")).join("\n"));
  };
  const exportRawData = (clean?: boolean) => {
    const head = ["study_id", "timepoint", "week", "assessed"].concat(E.ACTIVE.map((m) => m.id));
    const rows: (string | number)[][] = [head];
    S.cohort!.participants.forEach((p) =>
      p.obs.forEach((o, ti) => {
        if (clean && o.missing) return;
        rows.push(
          ([p.sid, E.TIMEPOINTS[ti].id, E.TIMEPOINTS[ti].week, o.missing ? 0 : 1] as (string | number)[]).concat(
            E.ACTIVE.map((m) => {
              if (o.missing) return "";
              const v = o.values[m.id];
              if (clean && !E.valid(m.id, v)) return "";
              return v ?? "";
            })
          )
        );
      })
    );
    download(`${clean ? "analytical" : "raw"}-dataset-synthetic-v4.csv`, rows.map((r) => r.join(",")).join("\n"));
  };
  const exportClustersCsv = () => {
    if (!run || !cur) return;
    const rows: (string | number)[][] = [["study_id", "cluster", "algorithm", "k", "seed", "feature_set", "missing_strategy"]];
    run.feat.keep.forEach((i, r) => rows.push([S.cohort!.participants[i].sid, cur.lab[r] + 1, run.algo, S.k, run.seed, run.featureSet, run.missing]));
    download(`cluster-assignments-k${S.k}-${run.algo}.csv`, rows.map((r) => r.join(",")).join("\n"));
  };
  const exportPerf = () => {
    const c = S.clf;
    if (!c) return;
    const rows: (string | number)[][] = [
      ["metric", "value"],
      ["accuracy", c.accuracy.toFixed(4)],
      ["balanced_accuracy", c.balanced.toFixed(4)],
      ["macro_f1", c.macroF1.toFixed(4)],
      ["n_train", c.nTrain],
      ["n_test", c.nTest],
      ["n_predictors", c.nFeatures],
    ];
    c.perClass.forEach((p) => rows.push([`cluster_${p.c + 1}_recall`, p.rec.toFixed(4)]));
    download(`model-performance-${S.clfModel}-${S.clfAlgo}.csv`, rows.map((r) => r.join(",")).join("\n"));
  };

  let screenBody: React.ReactNode;
  switch (state.screen) {
    case "dashboard": {
      if (S.realLoading || !S.realCohort || !S.realQuality) {
        screenBody = <div style={{ padding: 24 }}>{S.realError ? `Failed to load real data: ${S.realError}` : "Loading…"}</div>;
        break;
      }
      const rc = S.realCohort;
      const rq = S.realQuality;
      const tpCards = E.TIMEPOINTS.map((tp, ti) => {
        const n = rq.grid[ti].assessed;
        return { label: tp.label, n, pct: rc.n ? (100 * n) / rc.n : 0, pctLabel: rc.n ? pct1((100 * n) / rc.n) : "—" };
      });
      const cw = 72,
        chh = 30,
        mx0 = 92,
        my0 = 30;
      const missCols = E.TIMEPOINTS.map((tp, i) => ({ label: tp.short, x: mx0 + cw * i + cw / 2, y: my0 - 12 }));
      const missRows = E.ACTIVE.map((m, r) => ({ label: m.name, y: my0 + chh * r + chh / 2 + 4 }));
      const missCells = E.ACTIVE.flatMap((m, rIdx) =>
        E.TIMEPOINTS.map((tp, i) => {
          const c = rq.grid[i].byMeasure[m.id]!;
          const p = c.missing + c.present ? (100 * c.missing) / (c.missing + c.present) : 0;
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
      screenBody = (
        <DashboardScreen
          V={{
            tpCards,
            quality: {
              completeBaseline: rq.completeBaseline,
              incompleteBaseline: rq.incompleteBaseline,
              pMissLabel: rc.n ? pct1(rq.participantMissingness.mean) : "—",
            },
            // No real flag-detection logic exists yet (out-of-range values,
            // duplicates, etc.) -- real data entered through the Enrolment/
            // Assessment forms also can't produce most of these today.
            flags: [],
            missGrid: {
              vb: `0 0 ${mx0 + cw * 6 + 4} ${my0 + chh * E.ACTIVE.length + 6}`,
              cols: missCols,
              rows: missRows,
              cells: missCells,
            },
            // Phenotype analysis (clustering/classification) isn't built on
            // the backend yet -- this stays a placeholder, not fabricated
            // synthetic numbers, now that the rest of this screen is real.
            status: {
              algoName: "Not available yet",
              featureLine: "Phenotype analysis isn't built yet",
              smallest: "—",
              sil: "—",
              db: "—",
              stability: "not available",
              stabilityNote: "clustering is a later project",
              clfAcc: "—",
              clfNote: "classification is a later project",
              provisional: "none",
              provisionalNote: "no analysis engine yet",
            },
            k: 0,
            onExportQuality: () => {},
          }}
        />
      );
      break;
    }
    case "enrol": {
      if (S.editLoading || S.editError) {
        screenBody = <div style={{ padding: 24 }}>{S.editError ? `Failed to load participant: ${S.editError}` : "Loading…"}</div>;
        break;
      }
      const e = S.enrol;
      const bmi = e.height > 0 ? e.weight / Math.pow(e.height / 100, 2) : 0;
      const ageOk = e.age >= 18 && e.age <= 80;
      const incDone = e.inc.every((v) => v === true);
      const excClear = e.exc.every((v) => v === false);
      const answered = e.inc.every((v) => v !== null) && e.exc.every((v) => v !== null);
      const failed = e.inc.some((v) => v === false) || e.exc.some((v) => v === true);
      const eligible = incDone && excClear && ageOk;
      // Editing an existing participant takes priority over the "just
      // enrolled" confirmation -- the two never apply at once, since
      // startEditingParticipant/enrolAndSave each clear the other's state.
      const editing = S.editingParticipant;
      const confirmed = !editing ? S.enrolledParticipant : null;
      const base = editing ? new Date(editing.enrolledAt) : confirmed ? new Date(confirmed.enrolledAt) : new Date();
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
      // The real study ID is generated by the backend (a Postgres sequence)
      // only once `enroll` actually succeeds -- it can't be known or
      // predicted before saving, so the pre-save preview says so honestly
      // rather than showing a fabricated ID.
      const sid = editing ? editing.sid : confirmed ? confirmed.sid : "assigned when you save";
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
            confirmed: !!confirmed,
            editing: !!editing,
            editBlocked: S.editSave.kind === "saving",
            blocked: !(eligible && e.consent) || S.enrolSave.kind === "saving",
            actionNote: editing
              ? S.editSave.kind === "saving"
                ? "Saving…"
                : "Saves changes to this participant's record."
              : confirmed
                ? "Give this Study ID and schedule to the participant."
                : !eligible
                  ? "Blocked until every criterion is recorded and met."
                  : !e.consent
                    ? "Blocked until consent is recorded."
                    : S.enrolSave.kind === "saving"
                      ? "Saving…"
                      : "Saves a real participant via the backend.",
            schedule: REAL_TIMEPOINTS.map((tp, i) => {
              const d = new Date(base.getTime() + tp.weekOffset * 7 * 86400000);
              return {
                id: tp.id,
                label: tp.label,
                date: iso(d),
                window: i === 0 ? "on the day" : "±" + tp.windowDays + " days",
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
              REAL_TIMEPOINTS.length,
            onEnrol: enrolAndSave,
            onReset: () => set("enrol", { ...ENROL_DEFAULT }),
            onContinue: continueToAssessment,
            onEnrolAnother: enrolAnother,
            onSaveEdit: saveParticipantEdit,
            onCancelEdit: cancelEditingParticipant,
            saveStatus: editing ? S.editSave : S.enrolSave,
          }}
        />
      );
      break;
    }
    case "participants": {
      if (S.realLoading || !S.realCohort || !S.realMeasures) {
        screenBody = <div style={{ padding: 24 }}>{S.realError ? `Failed to load real data: ${S.realError}` : "Loading…"}</div>;
        break;
      }
      const realCohort = S.realCohort;
      const usedReal = S.realMeasures.filter((m) => m.active);
      if (!realCohort.participants.length || !usedReal.length) {
        screenBody = (
          <div style={{ padding: 24 }}>
            {realCohort.participants.length ? "No active measures configured." : "No real participants enrolled yet."}
          </div>
        );
        break;
      }
      const selIdx = Math.min(S.selIdx, realCohort.participants.length - 1);
      const q = S.query.trim().toUpperCase();
      const matches = realCohort.participants.map((p, i) => ({ p, i })).filter((x) => !q || x.p.sid.includes(q));
      const listNote = `showing ${Math.min(60, matches.length)} of ${matches.length}`;
      const roster: RosterRow[] = matches.slice(0, 60).map(({ p, i }) => ({
        sid: p.sid,
        sel: selIdx === i,
        go: () => set("selIdx", i),
        // No clustering exists for real participants yet (that's the
        // analysis-engine follow-on project) -- always the neutral,
        // no-cluster-assigned colour.
        color: "var(--color-neutral-300)",
        dots: p.obs.map((o) => ({ fill: o.missing ? "var(--color-neutral-300)" : "var(--color-neutral-800)" })),
      }));
      const sp = realCohort.participants[selIdx];
      // fetchRealCohort()'s reshaped Participant has no numeric id (shared
      // with the synthetic-data screens, which have none) -- look it up by
      // sid from entryParticipants, the same {id,sid} list Assessment
      // Entry's picker fetches.
      const spId = S.entryParticipants?.find((p) => p.sid === sp.sid)?.id;
      const selVals = {
        sid: sp.sid,
        meta: `${sp.age}y · ${sp.sex} · BMI ${sp.bmi} · symptoms ${sp.durationWeeks}w · ${sp.episodes} prior episodes · ${sp.site}`,
        riskTag: "conventional risk: not yet assigned",
        clusterLabel: "not in current analysis set",
      };

      const measureSeries = (mid: MeasureId) =>
        E.TIMEPOINTS.map((tp, ti) => {
          const vals = realCohort.participants
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
        const m = usedReal.find((x) => x.id === mid)!;
        let lo = Infinity,
          hi = -Infinity;
        realCohort.participants.forEach((p) =>
          p.obs.forEach((o) => {
            const v = o.missing ? null : o.values[mid];
            if (!E.valid(mid, v)) return;
            lo = Math.min(lo, v!);
            hi = Math.max(hi, v!);
          })
        );
        if (lo > hi) [lo, hi] = [m.min, m.max];
        const pad = (hi - lo) * 0.06;
        return [Math.max(m.min, Math.floor(lo - pad)), Math.min(m.max, Math.ceil(hi + pad))];
      };

      const panels: TrajectoryPanelData[] = usedReal.map((m) => {
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

      const popDomains: ToggleOpt[] = usedReal.map((m) => ({ label: m.name, on: S.popDomain === m.id, go: () => set("popDomain", m.id) }));
      const popViews: ToggleOpt[] = (
        [
          ["individual", "Individuals"],
          ["mean", "Mean + CI"],
          ["both", "Both"],
        ] as ["individual" | "mean" | "both", string][]
      ).map(([id, name]) => ({ label: name, on: S.popView === id, go: () => set("popView", id) }));

      const pd = usedReal.find((m) => m.id === S.popDomain) || usedReal[0];
      const [plo, phi] = domainRange(pd.id);
      const popSFull = measureSeries(pd.id);
      const pgx = (w: number) => gx(w, W, PL, PR);
      const pgy = (v: number) => gy(v, plo, phi, 260);
      const showInd = S.popView !== "mean";
      const showMean = S.popView !== "individual";
      const spag = showInd
        ? realCohort.participants
            .filter((_, i) => i % 3 === 0)
            .map((p) => {
              const pts: string[] = [];
              E.TIMEPOINTS.forEach((tp, ti) => {
                const o = p.obs[ti];
                const v = o.missing ? null : o.values[pd.id];
                if (!E.valid(pd.id, v)) return;
                pts.push(pgx(tp.week).toFixed(1) + "," + pgy(v!).toFixed(1));
              });
              // No clustering for real participants yet -- single neutral colour.
              return { points: pts.join(" "), color: "#7d7979" };
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
            onEdit: () => {
              if (spId !== undefined) startEditingParticipant(spId);
            },
            editDisabled: spId === undefined,
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
      const selectedParticipant = S.entryParticipants?.find((p) => p.id === S.selectedParticipantId) ?? null;
      const selectedTimepoint = REAL_TIMEPOINTS.find((t) => t.id === S.selectedTimepointId) ?? REAL_TIMEPOINTS[0];
      screenBody = (
        <AssessmentEntryScreen
          V={{
            participants: S.entryParticipants ?? [],
            participantsLoading: S.entryParticipantsLoading,
            participantsError: S.entryParticipantsError,
            selectedParticipantId: S.selectedParticipantId,
            onSelectParticipant: (id) => patch({ selectedParticipantId: id }),
            timepoints: REAL_TIMEPOINTS,
            selectedTimepointId: S.selectedTimepointId,
            onSelectTimepoint: (id) => patch({ selectedTimepointId: id }),
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
              "study_id: " +
              (selectedParticipant?.sid ?? "none") +
              "\ntimepoint: " +
              selectedTimepoint.id +
              "\nnprs_items: [" +
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
            onSave: saveAssessment,
            canSave: !!S.selectedParticipantId && S.entrySave.kind !== "saving",
            saveStatus: S.entrySave,
          }}
        />
      );
      break;
    }
    case "measures": {
      if (S.measuresLoading || !S.realMeasures) {
        screenBody = <div style={{ padding: 24 }}>{S.measuresError ? `Failed to load: ${S.measuresError}` : "Loading…"}</div>;
        break;
      }
      const realMeasures = S.realMeasures;
      const activeCount = realMeasures.filter((m) => m.active).length;
      const refreshMeasures = () => {
        patch({ measuresLoading: true, measuresError: null });
        fetchMeasures()
          .then((measures) => patch({ realMeasures: measures, measuresLoading: false }))
          .catch((err) =>
            patch({ measuresError: err instanceof Error ? err.message : "Failed to load measures", measuresLoading: false })
          );
      };
      const onUpdateFail = (err: unknown) => patch({ measuresError: err instanceof Error ? err.message : "Update failed" });
      const measureRows = realMeasures.map((m) => {
        const on = m.active;
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
              updateMeasure(m.id, { dir: v }).then(refreshMeasures).catch(onUpdateFail);
            },
          })),
          lock: on && activeCount < 2,
          stateLabel: on ? "remove" : "add",
          stateNote: on ? "in analysis" : "excluded",
          toggle: () => {
            if (on && activeCount < 2) return;
            updateMeasure(m.id, { active: !on }).then(refreshMeasures).catch(onUpdateFail);
          },
        };
      });
      const alignCards = realMeasures
        .filter((m) => m.active)
        .map((m) => ({
          name: m.name,
          raw: m.dir === "worse" ? "raw: higher = worse" : "raw: higher = better",
          transform: (m.dir === "worse" ? "× −1" : "× +1") + " then z-score",
        }));
      const tpRows = E.TIMEPOINTS.map((tp, i) => ({
        id: tp.id,
        label: tp.label,
        week: tp.week,
        window: i === 0 ? "—" : "±" + (tp.week <= 4 ? 3 : 7) + " days",
        n: S.realQuality ? S.realQuality.grid[i].assessed : 0,
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
            onExportFeatures: exportFeatures,
          }}
        />
      );
      break;
    }
    case "solutions": {
      const solutionRows = S.solutions.map((s) => ({
        id: s.id,
        time: s.time,
        k: s.k,
        algo: s.algoName,
        seed: s.seed,
        featureSet: s.featureSet,
        nFeat: s.nFeat,
        measures: s.measures,
        missing: s.missing,
        n: s.n,
        smallest: `${s.met.smallest} (${s.met.smallestPct.toFixed(1)}%)`,
        sil: fmt(s.met.silhouette),
        ch: fmt(s.met.ch, 0),
        db: fmt(s.met.db),
        stab: s.stab || "not run",
        bg: S.provisional === s.id ? "var(--color-accent-100)" : "transparent",
        markLabel: S.provisional === s.id ? "provisional ✓" : "mark",
        mark: () => set("provisional", S.provisional === s.id ? null : s.id),
      }));
      const solutionsNote = S.solutions.length
        ? "No row is highlighted by the software on quality grounds. Marking a solution provisional records a researcher decision in the analysis record; it does not lock anything."
        : "No runs kept yet. Configure a run on the Discovery screen and add it to the comparison.";
      const sensLabel = S.sensBusy ? "running…" : S.sens ? "Re-run sensitivity" : "Run sensitivity analysis";
      const sensRows = S.sens
        ? S.sens.map((r) => ({ label: r.label, value: fmt(r.ari), pct: Math.max(0, 100 * r.ari) }))
        : [{ label: S.sensBusy ? "Computing alternative specifications…" : "Not run for this specification yet", value: "—", pct: 0 }];

      let crossCols: { label: string }[] = [];
      let crossRows: { label: string; n: number; cells: { txt: string; bg: string }[] }[] = [];
      let cross = { kappa: "—", ari: "—", v: "—", note: "" };
      if (lab && run) {
        const groups: ("low" | "moderate" | "high")[] = ["low", "moderate", "high"];
        const tab = groups.map(() => new Array(S.k).fill(0));
        run.feat.keep.forEach((i, r) => {
          // S.cohort is always the synthetic cohort here, which never
          // produces "unknown" -- only real participants do.
          tab[groups.indexOf(S.cohort!.participants[i].conventional as "low" | "moderate" | "high")][lab[r]]++;
        });
        const tot = run.feat.keep.length;
        const rowN = tab.map((r) => r.reduce((a, b) => a + b, 0));
        const colN: number[] = [];
        for (let c = 0; c < S.k; c++) colN.push(tab.reduce((a, r) => a + r[c], 0));
        let chi = 0;
        tab.forEach((r, i) =>
          r.forEach((o, c) => {
            const e = (rowN[i] * colN[c]) / tot;
            if (e > 0) chi += (o - e) ** 2 / e;
          })
        );
        const kmax = Math.min(3, S.k);
        let agree = 0,
          expAgree = 0;
        for (let i = 0; i < kmax; i++) {
          agree += tab[i][i];
          expAgree += (rowN[i] * colN[i]) / tot;
        }
        crossCols = Array.from({ length: S.k }, (_, c) => ({ label: "C" + (c + 1) }));
        crossRows = groups.map((g, i) => ({
          label: g,
          n: rowN[i],
          cells: tab[i].map((v) => ({
            txt: v ? String(v) : "·",
            bg: v ? `color-mix(in srgb, var(--color-accent) ${Math.min(45, Math.round((60 * v) / (rowN[i] || 1)))}%, transparent)` : "transparent",
          })),
        }));
        cross = {
          kappa: fmt((agree / tot - expAgree / tot) / (1 - expAgree / tot)),
          ari: fmt(E.ari(run.feat.keep.map((i) => S.cohort!.participants[i].conventional), lab)),
          v: fmt(Math.sqrt(chi / (tot * Math.min(2, S.k - 1)))),
          note: `Low agreement is a result, not a failure: it is the case that the conventional grouping and the data-derived phenotypes are not the same partition. χ² = ${chi.toFixed(1)}, df = ${2 * (S.k - 1)}.`,
        };
      }

      screenBody = (
        <SolutionsScreen
          V={{
            solutionRows,
            solutionsNote,
            sensLabel,
            onRunSensitivity: runSensitivity,
            sensRows,
            k: S.k,
            crossCols,
            crossRows,
            cross,
          }}
        />
      );
      break;
    }
    case "profiles": {
      const CC = E.CLUSTER_COLORS;
      const profs = lab && run ? E.profile(S.cohort!, run.feat, lab, S.k, S.enabled) : [];
      const clusters: ClusterCard[] = profs.map((p) => {
        const pw = 300,
          ph = 132,
          pl = 26;
        const gxc = (w: number) => gx(w, pw, pl, 42);
        const gyc = (v: number) => gy(v, 0.1, 1.1, ph);
        const lines: ClusterTrajectoryLine[] = p.domains.map((d, di) => {
          const b = d.traj[0].mean || 1;
          const present = d.traj.filter((t) => t.mean !== null);
          const pts = present.map((t) => gxc(t.week).toFixed(1) + "," + gyc(t.mean! / b).toFixed(1));
          const last = present[present.length - 1];
          return {
            name: d.measure.name,
            color: ["#ec3013", "#201e1d", "#7d7979", "#ae1800"][di % 4],
            w: di === 0 ? 2.5 : 1.8,
            dash: di === 3 ? "4 3" : "0",
            points: pts.join(" "),
            lx: gxc(last.week) + 4,
            ly: gyc(last.mean! / b) + 3,
          };
        });
        // De-overlap the trailing labels: sorted by Y, push down anything
        // closer than 10px to the previous label.
        lines
          .map((l, i) => ({ i, ly: l.ly }))
          .sort((a, b) => a.ly - b.ly)
          .reduce((prev, e) => {
            const y = Math.max(e.ly, prev + 10);
            lines[e.i].ly = y;
            return y;
          }, -1e4);
        const xTicks = p.domains[0].traj.map((t) => ({ x: gxc(t.week), y: ph - 4, label: t.short }));
        return {
          label: p.label,
          color: CC[p.c],
          n: p.n,
          pct: p.pct.toFixed(1) + "%",
          age: p.age.toFixed(0),
          female: p.female.toFixed(0) + "%",
          bmi: p.bmi.toFixed(1),
          duration: p.duration.toFixed(0) + "w",
          domains: p.domains.map((d) => ({
            domain: d.measure.domain,
            shape: d.shape,
            delta: (d.relChange >= 0 ? "−" : "+") + Math.abs(100 * d.relChange).toFixed(0) + "% by W12",
          })),
          chart: { vb: `0 0 ${pw} ${ph}`, zx1: pl, zx2: pw - 42, zy: gyc(1), lines, xTicks, ariaLabel: `${p.label} standardised trajectories` },
          note: S.notes[p.c] || "",
          setNote: (ev) => patch((s) => ({ notes: { ...s.notes, [p.c]: ev.target.value } })),
          stability: S.boot ? S.boot.perCluster[p.c].toFixed(0) + "%" : "not run",
        };
      });

      const bootLabel = S.bootBusy ? "running…" : S.boot ? "Re-run" : "Run bootstrap";
      const boot: BootVals = S.boot
        ? {
            meanARI: fmt(S.boot.meanARI),
            interval: `${fmt(S.boot.lowARI)}–${fmt(S.boot.highARI)}`,
            iters: S.boot.iters,
            bars: S.boot.perCluster.map((v, c) => ({ label: "Cluster " + (c + 1), color: CC[c], pct: v, value: v.toFixed(0) + "%" })),
            note:
              "Per-cluster stability is the share of bootstrap replicates in which a cluster's members were recovered together. The iteration count is kept low here so the sample stays interactive; the protocol figure is 1,000.",
          }
        : {
            meanARI: "—",
            interval: "—",
            iters: S.bootBusy ? "…" : 0,
            bars: [],
            note: "Stability has not been assessed for this specification. Cluster profiles should not be interpreted before it has.",
          };

      let truthCols: { label: string }[] = [];
      let truthRows: { label: string; cells: { txt: string; bg: string }[] }[] = [];
      let truthARI = "—";
      if (lab && run) {
        const truth = run.feat.keep.map((i) => S.cohort!.participants[i].pattern);
        truthCols = Array.from({ length: S.k }, (_, c) => ({ label: "C" + (c + 1) }));
        truthRows = E.PATTERNS.map((pt) => {
          const rowTot = truth.filter((t) => t === pt.id).length;
          return {
            label: pt.name,
            cells: Array.from({ length: S.k }, (_, c) => {
              const v = truth.filter((t, r) => t === pt.id && lab[r] === c).length;
              return {
                txt: v ? String(v) : "·",
                bg: v ? `color-mix(in srgb, var(--color-accent) ${Math.min(50, Math.round((64 * v) / (rowTot || 1)))}%, transparent)` : "transparent",
              };
            }),
          };
        });
        truthARI = fmt(E.ari(truth, lab));
      }

      screenBody = (
        <ProfilesScreen
          V={{
            clusters,
            bootIters: S.bootIters,
            setBootIters: (ev) => set("bootIters", +ev.target.value || 25),
            bootLabel,
            onRunBoot: runBoot,
            boot,
            truthCols,
            truthRows,
            truthARI,
          }}
        />
      );
      break;
    }
    case "classify": {
      const modelOpts: ModelOpt[] = E.EARLY_MODELS.map((m) => {
        const key = [S.k, m.id, S.clfAlgo, run?.algo, run?.featureSet, run?.missing].join("|");
        const r = S.clfAll[key];
        return {
          name: m.name,
          info: m.info,
          on: S.clfModel === m.id,
          acc: r ? pct1(100 * r.balanced) + " bal." : S.clfModel === m.id ? "computing…" : "not run",
          go: () => {
            set("clfModel", m.id);
            if (run) runClf(E, S.cohort!, run, { clfModel: m.id });
          },
        };
      });
      const clfOpts = E.CLASSIFIERS.map((c) => ({
        label: c.name + (c.run ? "" : " — adapter slot, not implemented"),
        dis: !c.run,
        op: c.run ? 1 : 0.45,
        on: S.clfAlgo === c.id,
        go: () => {
          set("clfAlgo", c.id);
          if (run) runClf(E, S.cohort!, run, { clfAlgo: c.id });
        },
      }));
      const clfNote = E.CLASSIFIERS.find((c) => c.id === S.clfAlgo)!.note;
      const algoName = E.ALGORITHMS.find((a) => a.id === S.algo)!.name;

      const c2 = S.clf;
      const clfVals = c2
        ? {
            accuracy: pct1(100 * c2.accuracy),
            balanced: pct1(100 * c2.balanced),
            macroF1: fmt(c2.macroF1),
            split: `${c2.nTrain} train / ${c2.nTest} held out · ${c2.nFeatures} predictors · stratified, by participant`,
            perClass: c2.perClass.map((p) => ({
              label: "Cluster " + (p.c + 1),
              color: E.CLUSTER_COLORS[p.c],
              n: p.n,
              rec: fmt(p.rec),
              prec: fmt(p.prec),
              spec: fmt(p.spec),
              f1: fmt(p.f1),
            })),
            cases: c2.sampleCases.map((s) => ({ sid: s.sid, pred: s.pred, conf: fmt(s.conf) })),
          }
        : { accuracy: "—", balanced: "—", macroF1: "—", split: "computing…", perClass: [], cases: [] };

      let cm: ConfusionMatrixData = { vb: "0 0 0 0", cols: [], rows: [], cells: [], axX: 0, axY: 0 };
      let cal: CalibrationCurveData = { vb: "0 0 0 0", d1x: 0, d1y: 0, d2x: 0, d2y: 0, points: "", dots: [], ticks: [] };
      if (c2) {
        const cs = Math.min(58, 300 / S.k),
          ox = 52,
          oy = 26;
        const cols = Array.from({ length: S.k }, (_, c) => ({ label: "C" + (c + 1), x: ox + cs * c + cs / 2, y: oy - 8 }));
        const rows = Array.from({ length: S.k }, (_, r) => ({ label: "C" + (r + 1), lx: ox - 6, ly: oy + cs * r + cs / 2 + 3 }));
        const cells = c2.cm.flatMap((row, r) => {
          const tot = row.reduce((a, b) => a + b, 0) || 1;
          return row.map((v, c) => ({
            x: ox + cs * c,
            y: oy + cs * r,
            w: cs,
            h: cs,
            txt: v ? String(v) : "·",
            tx: ox + cs * c + cs / 2,
            ty: oy + cs * r + cs / 2 + 4,
            fill: r === c ? "#ec3013" : "#201e1d",
            op: Math.min(0.9, 0.05 + (0.85 * v) / tot),
            ink: v / tot > 0.45 ? "#f3f2f2" : "#201e1d",
          }));
        });
        cm = { vb: `0 0 ${ox + cs * S.k + 8} ${oy + cs * S.k + 26}`, cols, rows, cells, axX: ox + (cs * S.k) / 2, axY: oy + cs * S.k + 18 };

        const cw3 = 300,
          ch3 = 150,
          pl3 = 34;
        const gxc = (v: number) => pl3 + v * (cw3 - pl3 - 10);
        const gyc = (v: number) => 12 + (1 - v) * (ch3 - 12 - 22);
        const bins = c2.bins.filter((b) => b.n);
        cal = {
          vb: `0 0 ${cw3} ${ch3}`,
          d1x: gxc(0),
          d1y: gyc(0),
          d2x: gxc(1),
          d2y: gyc(1),
          points: bins.map((b) => gxc(b.conf).toFixed(1) + "," + gyc(b.acc).toFixed(1)).join(" "),
          dots: bins.map((b) => ({ x: gxc(b.conf) - 3, y: gyc(b.acc) - 3 })),
          ticks: [
            { x: pl3 - 5, y: gyc(0) + 3, label: "0", anchor: "end" as const },
            { x: pl3 - 5, y: gyc(1) + 3, label: "1.0", anchor: "end" as const },
            { x: gxc(0), y: ch3 - 6, label: "0", anchor: "middle" as const },
            { x: gxc(0.5), y: ch3 - 6, label: "confidence 0.5", anchor: "middle" as const },
            { x: gxc(1), y: ch3 - 6, label: "1.0", anchor: "middle" as const },
          ],
        };
      }

      screenBody = (
        <ClassificationScreen
          V={{
            modelOpts,
            clfOpts,
            clfNote,
            k: S.k,
            algoName,
            clf: clfVals,
            cm,
            cal,
          }}
        />
      );
      break;
    }
  }

  const record: { k: string; v: string }[] = [
    ["Dataset version", `synthetic-v4 · generator seed ${S.seed} · N = ${S.cohort!.n}`],
    ["Run timestamp", run ? run.at.toISOString().replace("T", " ").slice(0, 19) + "Z" : "—"],
    ["Algorithm", E.ALGORITHMS.find((a) => a.id === (run ? run.algo : S.algo))!.name],
    ["Hyperparameters", E.ALGORITHMS.find((a) => a.id === (run ? run.algo : S.algo))!.note],
    ["Random seed", String(run ? run.seed : S.seed)],
    ["Number of clusters", `K = ${S.k} · swept 2–8`],
    ["Preprocessing", "direction alignment to common recovery sense → z-score per feature"],
    [
      "Missing-data method",
      run ? (run.missing === "complete" ? `complete cases (${run.feat.nDropped} dropped)` : "column-mean imputation on derived features") : "—",
    ],
    ["Feature construction", run ? `${run.feat.setName} — ${run.feat.names.length} features` : "—"],
    ["Measures included", used.map((m) => `${m.name} (${m.dir === "worse" ? "higher worse" : "higher better"})`).join(", ")],
    ["Analysed sample", run ? `${run.feat.keep.length} of ${S.cohort!.n} participants` : "—"],
    ["Validation", S.boot ? `bootstrap ×${S.boot.iters}, mean ARI ${fmt(S.boot.meanARI)}` : "not yet run"],
    ["Sensitivity analysis", S.sens ? `${S.sens.length} alternative specifications compared` : "not yet run"],
    ["Classifier", `${E.CLASSIFIERS.find((c) => c.id === S.clfAlgo)!.name} · ${E.EARLY_MODELS.find((m) => m.id === S.clfModel)!.info}`],
    ["Provisional solution", prov ? `${prov.id} (marked by researcher)` : "none — no automatic selection"],
    ["Researcher interpretations", `${Object.values(S.notes).filter(Boolean).length} cluster note(s) recorded`],
    ["Environment", "sample UI · engine v0.4 · deterministic JS implementation"],
  ].map(([k2, v]) => ({ k: k2, v }));

  const exports: { name: string; fmt: string; go: () => void; dis?: boolean }[] = [
    { name: "Raw longitudinal dataset", fmt: "CSV", go: () => exportRawData() },
    { name: "Clean analytical dataset", fmt: "CSV", go: () => exportRawData(true) },
    { name: "Feature dataset", fmt: "CSV", go: exportFeatures, dis: !run },
    { name: "Cluster assignments", fmt: "CSV", go: exportClustersCsv, dis: !lab },
    { name: "Data-quality report", fmt: "CSV", go: exportQuality },
    { name: "Model performance", fmt: "CSV", go: exportPerf, dis: !S.clf },
    { name: "Figures", fmt: "PNG · SVG · PDF", go: () => {}, dis: true },
    { name: "Analysis report", fmt: "PDF · HTML", go: () => {}, dis: true },
  ];

  return (
    <InfoTipProvider>
      <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
        <Nav
          screen={state.screen}
          onNavigate={(s) => set("screen", s)}
          onOpenRecord={() => set("recordOpen", true)}
          datasetVersion="synthetic-v4"
          seed={state.seed}
          showSyntheticBanner={SYNTHETIC_SCREENS.has(state.screen)}
        />
        <main style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 16px 72px" }}>{screenBody}</main>
        {state.recordOpen && <AnalysisRecordDrawer V={{ record, exports, onClose: () => set("recordOpen", false) }} />}
      </div>
    </InfoTipProvider>
  );
}
