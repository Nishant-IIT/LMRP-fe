# Recovery Phenotyping Platform Implementation Plan

> **For agentic workers:** This plan is executed **inline, in the same session that wrote it** — the executor already holds the full source spec (the Claude Design `.dc.html`, its logic script, and `phenotype-engine.js`) in context. Tasks therefore specify exact field/behavior mappings rather than re-transcribing the original markup. If resumed by a fresh worker, re-read the design project first (`claude_design` MCP, project `28f00b8c-877e-43cc-bded-b44b054f8c8f`) before starting any task — the mappings below assume familiarity with that source.

**Goal:** Port the "Recovery Phenotyping Platform" Claude Design canvas (`Recovery Phenotyping Platform.dc.html`) into a real Next.js 16 / React 19 / TypeScript application in this repo — a 9-screen MSK recovery research tool (synthetic cohort, data quality, phenotype discovery/clustering, cluster profiling, early classification) styled with the "Modernist" design system.

**Architecture:** One client-rendered feature (`components/platform/`) mounted from `app/page.tsx`. A single top-level state container (`RecoveryPhenotypingPlatform.tsx`) mirrors the original `Component`'s `state` shape and owns all business logic (recompute/bootstrap/sensitivity/classification/export), matching its structure closely so it can be checked line-by-line against the source. Nine screen components render off derived "vals" computed the same way the original's `renderVals()` did, but as plain TS functions/`useMemo` instead of a template-interpolation engine. The analysis engine (`phenotype-engine.js` — synthetic data generator, clustering, metrics, classifiers) is ported near-verbatim to TypeScript since its numerics must stay bit-for-bit reproducible. The dc-runtime (`support.js`, `<x-dc>`, `{{ }}` templating) is Claude Design preview-only tooling and is **not** ported — it's fully replaced by real JSX.

**Tech Stack:** Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5, plain CSS via custom properties (the Modernist design system — **not** Tailwind utilities; Tailwind's `@import` is removed from `globals.css` to avoid its preflight fighting Modernist's own base styles, see Task 0). `next/font/google` for Archivo. `vitest` added as a new devDependency, scoped to unit-testing the numerical engine only (see Task 1 rationale).

**Spec:** Claude Design project `28f00b8c-877e-43cc-bded-b44b054f8c8f` ("Form UI sample request"), file `Recovery Phenotyping Platform.dc.html` (1843 lines: template lines 1–949, logic script lines 950–1839), plus `phenotype-engine.js`, `_ds/modernist-.../styles.css`, and `_ds/modernist-.../readme.md`. A working extracted copy of the `.dc.html` was saved this session to the scratchpad (`scratchpad/design/platform.dc.html`) for line-numbered reference — re-fetch via `DesignSync.get_file` if that scratch copy is gone.

## Global Constraints

- Preserve all copy verbatim (screen prose, glossary text in `GLOSSARY`, button labels, table headers) — this is authored clinical/UX copy, not placeholder text.
- Zero border-radius everywhere (`--radius-md: 0` etc.) — a deliberate Modernist rule ("Do not round a corner anywhere"). Never introduce a rounded-corner utility.
- Take every color/spacing/font/shadow from the Modernist CSS custom properties (`var(--color-*)`, `var(--space-*)`, `var(--font-*)`, `var(--shadow-*)`); never hardcode a hex or px value the tokens already carry.
- No icon library — the spec's Modernist readme mentions Lucide as available, but the actual `.dc.html` template uses zero icon glyphs (only colored square/dot indicators via CSS `background`). Do not add `lucide-react` or any icon dependency.
- The synthetic cohort generator must stay deterministic and reproducible from its seed (default `20260913`) — port `rng()` (mulberry32-style) and `gauss()` (Box–Muller) exactly; the UI advertises "same seed reproduces exactly the same result."
- Keyboard focus must use `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` (already in the ported Modernist CSS) — never leave default browser focus rings.
- All 9 screens, the analysis-record drawer, and the info-tooltip system are in scope; nothing is a stretch goal.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/layout.tsx` | Modify | Archivo font via `next/font/google` (replaces Geist), page metadata |
| `app/globals.css` | Modify | Modernist tokens + component classes + page-scoped extra CSS (replaces Tailwind import) |
| `app/page.tsx` | Modify | Thin: renders `<RecoveryPhenotypingPlatform />` |
| `lib/types.ts` | Create | Shared TS types: `Cohort`, `Participant`, `Measure`, `Features`, `ClusterMetrics`, `ClassifierResult`, `PlatformState`, etc. |
| `lib/phenotype-engine.ts` | Create | Ported analysis engine (generator, clustering, metrics, classifiers) |
| `lib/phenotype-engine.test.ts` | Create | Vitest unit tests for the engine |
| `lib/glossary.ts` | Create | The `GLOSSARY` term→definition map |
| `lib/download.ts` | Create | `download(name, text)` CSV-blob helper |
| `lib/svg-chart.ts` | Create | Shared chart geometry helpers: `gx/gy/ticks`, the SVG `<text>` label builder (`T`) |
| `components/platform/RecoveryPhenotypingPlatform.tsx` | Create | Top-level `'use client'` state container, mount/recompute/export logic, screen switch |
| `components/platform/Nav.tsx` | Create | Top nav bar + synthetic-data-mode banner |
| `components/platform/InfoTip.tsx` | Create | `InfoTipProvider` context, `<Info id="…"/>` trigger button, floating tooltip panel |
| `components/platform/AnalysisRecordDrawer.tsx` | Create | Right-side drawer: record table + export buttons |
| `components/platform/charts/HBarList.tsx` | Create | "label + horizontal bar + value" rows (cluster sizes, bootstrap per-cluster, sensitivity) |
| `components/platform/charts/Heatmap.tsx` | Create | Missingness grid (Dashboard) |
| `components/platform/charts/TrajectoryPanel.tsx` | Create | Per-participant per-measure trajectory chart (Participants) |
| `components/platform/charts/PopulationChart.tsx` | Create | Population spaghetti/mean/median chart (Participants) |
| `components/platform/charts/MetricLineChart.tsx` | Create | Cluster-quality-vs-K line chart, reused 4× (Discovery) |
| `components/platform/charts/ClusterTrajectoryChart.tsx` | Create | Standardised per-cluster trajectory lines (Profiles) |
| `components/platform/charts/ConfusionMatrix.tsx` | Create | Confusion matrix heat-grid (Classification) |
| `components/platform/charts/CalibrationCurve.tsx` | Create | Calibration reliability curve (Classification) |
| `components/platform/screens/DashboardScreen.tsx` | Create | Study status screen |
| `components/platform/screens/EnrolmentScreen.tsx` | Create | Enrolment screen |
| `components/platform/screens/ParticipantsScreen.tsx` | Create | Participants and trajectories screen |
| `components/platform/screens/AssessmentEntryScreen.tsx` | Create | Assessment entry screen |
| `components/platform/screens/MeasuresScreen.tsx` | Create | Outcome measure configuration screen |
| `components/platform/screens/DiscoveryScreen.tsx` | Create | Phenotype discovery screen |
| `components/platform/screens/SolutionsScreen.tsx` | Create | Candidate solution comparison screen |
| `components/platform/screens/ProfilesScreen.tsx` | Create | Cluster profiles screen |
| `components/platform/screens/ClassificationScreen.tsx` | Create | Early phenotype classification screen |

## Interfaces (shape carried through every task)

```ts
// lib/types.ts — the core data shapes every later task imports
export type MeasureId = 'nprs' | 'odi' | 'sts' | 'fabq' | 'pseq' | 'tug';
export interface Measure { id: MeasureId; domain: string; name: string; full: string; min: number; max: number; dir: 'worse' | 'better'; items: number; unit?: string; active: boolean; }
export interface Observation { tp: string; missing: boolean; values: Partial<Record<MeasureId, number | null>>; complete?: number; itemsMissing?: number; }
export interface Participant { sid: string; pattern: number; age: number; sex: 'F' | 'M'; bmi: number; durationWeeks: number; episodes: number; conventional: 'low' | 'moderate' | 'high'; site: string; obs: Observation[]; }
export interface QualityFlag { sid: string; tp: string; kind: string; detail: string; }
export interface Cohort { participants: Participant[]; flags: QualityFlag[]; n: number; seed: number; version: string; }
export interface Features { names: string[]; Z: number[][]; keep: number[]; nDropped: number; setName: string; used: string[]; }
export interface ClusterMetrics { k: number; sizes: number[]; silhouette: number; ch: number; db: number; wss: number; smallest: number; smallestPct: number; }
export interface BootstrapResult { iters: number; meanARI: number; sdARI: number; lowARI: number; highARI: number; perCluster: number[]; }
export interface ClassifierResult {
  nFeatures: number; nTrain: number; nTest: number; cm: number[][];
  perClass: { c: number; n: number; prec: number; rec: number; spec: number; f1: number }[];
  bins: { lo: number; hi: number; n: number; conf: number; acc: number }[];
  accuracy: number; balanced: number; macroF1: number; meanConfidence: number;
  sampleCases: { sid: string; pred: number; conf: number }[];
}
```

```ts
// components/platform/RecoveryPhenotypingPlatform.tsx state shape — every screen reads a slice of this
interface EnrolState { age: number; sex: 'F' | 'M'; height: number; weight: number; duration: number; episodes: number; load: string; site: string; consent: boolean; inc: (boolean | null)[]; exc: (boolean | null)[]; }
interface EntryState { nprs: number; sts: number; odi: (number | null)[]; fabq: (number | null)[]; }
interface RunState { feat: Features; sweep: Record<number, { lab: number[]; m: ClusterMetrics } | null>; algo: string; featureSet: string; missing: string; seed: number; enabled: MeasureId[]; at: Date; }
interface SolutionRecord { id: string; k: number; algo: string; algoName: string; seed: number; featureSet: string; nFeat: number; measures: string; missing: string; n: number; met: ClusterMetrics; stab: string | null; time: string; }
type ScreenId = 'dashboard' | 'enrol' | 'participants' | 'entry' | 'measures' | 'discovery' | 'solutions' | 'profiles' | 'classify';
```

Each screen component's props are simply `{ V: <its slice> }` where `V` is the derived view-model computed in `RecoveryPhenotypingPlatform.tsx` — mirroring the original's `renderVals()` output object, just split per screen instead of one giant object.

---

### Task 0: Design system shell

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Test: manual (dev server)

**Interfaces:**
- Produces: CSS custom properties (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-heading`, `--font-body`) and component classes (`.btn*`, `.tag*`, `.field`, `.input`, `.radio`, `.seg*`, `.card*`, `.nav*`, `.table`, `.dialog*`, `.hr`, `.lbl`, `.text-muted`, `.mono`) available globally, plus the page-scoped extras from the `.dc.html`'s `<style>` block (`.num`, `.navbtn`, `.cellbtn`, `.rowbtn`, `.info`, `input[type="range"]` accent-color).

- [ ] **Step 1: Replace `app/globals.css`**

Content = the Modernist `styles.css` token/component layer (fetched this session from `_ds/modernist-21fb1413-bf6b-46e9-b490-0fb2fe5c114b/styles.css`) **minus** its `@import url('https://fonts.googleapis.com/css2?family=Archivo...')` line (replaced by `next/font` in layout.tsx — set `--font-heading` / `--font-body` to `var(--font-archivo)` instead of the literal `"Archivo", system-ui, sans-serif` list), **plus** the platform-specific extra rules from the `.dc.html`'s `<helmet><style>` block (lines 12–29 of the source): `.mono`, `.lbl`, `.num`, `.navbtn` (+ `:hover`, `[aria-current="page"]`), `.cellbtn` (+ `:hover`, `[aria-pressed="true"]`), `.rowbtn` (+ `:hover`, `[aria-current="true"]`), `input[type="range"] { accent-color: var(--color-accent); width: 100%; }`, `.info` (+ `:hover`, `[aria-expanded="true"]`), `th .info, .lbl .info { opacity: 0.8; }`. Do **not** keep `@import "tailwindcss";` or the Geist `--font-sans`/`--font-mono` variables.

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RE:PHENO — Recovery Phenotyping Platform",
  description: "MSK recovery phenotyping MVP — synthetic-data research tool for cohort status, data quality, phenotype discovery and early classification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import { RecoveryPhenotypingPlatform } from "@/components/platform/RecoveryPhenotypingPlatform";

export default function Page() {
  return <RecoveryPhenotypingPlatform />;
}
```

(This import doesn't exist yet — Step 4 creates a placeholder so the app boots.)

- [ ] **Step 4: Create a placeholder `RecoveryPhenotypingPlatform` so the build is green**

```tsx
// components/platform/RecoveryPhenotypingPlatform.tsx
"use client";
export function RecoveryPhenotypingPlatform() {
  return <div style={{ padding: 24 }}>Loading…</div>;
}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`, open the app in a browser. Expected: off-white (`#f3f2f2`) background, "Loading…" text in Archivo, no Tailwind reset artifacts, no console errors.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Set up Modernist design system shell and app scaffold"
```

---

### Task 1: Port the analysis engine

**Files:**
- Create: `lib/types.ts`
- Create: `lib/phenotype-engine.ts`
- Create: `lib/phenotype-engine.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `"test": "vitest run"` script)
- Create: `vitest.config.ts`

**Rationale for adding a test runner:** everything else in this plan is presentational and is verified visually in the browser (per this project's own convention — there is no existing test suite). The engine is different: it's ~500 lines of hand-rolled numerics (k-means++, Ward hierarchical clustering, EM Gaussian mixture, multinomial logistic regression, a small random forest, Adjusted Rand Index) ported into a new language variant. Bugs here are silent — a subtly wrong Ward linkage update or ARI formula produces plausible-looking-but-wrong numbers with no visual signal. This is the one module where unit tests carry real, non-redundant value.

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `rng(seed): () => number`, `mean/sd/median/quantile(arr): number`, `TIMEPOINTS: Timepoint[]`, `MEASURES: Measure[]`, `ACTIVE: Measure[]`, `PATTERNS`, `makeCohort(n, seed): Cohort`, `qualityReport(cohort): QualityReport`, `FEATURE_SETS`, `buildFeatures(cohort, setId, missingStrategy, enabled): Features`, `ALGORITHMS: {id,name,note,run}[]`, `cluster(Z, algoId, k, seed): number[] | null`, `metrics(Z, lab, k): ClusterMetrics`, `ari(a, b): number`, `bootstrap(Z, algoId, k, iters, seed): BootstrapResult | null`, `profile(cohort, feat, lab, k, enabled): ClusterProfile[]`, `EARLY_MODELS`, `CLASSIFIERS`, `runClassifier(cohort, feat, lab, k, modelId, clfId, seed, enabled): ClassifierResult | null`, `CLUSTER_COLORS: string[]`.

- [ ] **Step 1: Write `lib/types.ts`**

Use the exact interfaces from the "Interfaces" section above (`Measure`, `Observation`, `Participant`, `Cohort`, `Features`, `ClusterMetrics`, `BootstrapResult`, `ClassifierResult`, plus `QualityReport`, `ClusterProfile`, `DomainProfile`, `TrajPoint`, `Pattern`, `FeatureSet`, `Algorithm`, `EarlyModel`, `Classifier`).

- [ ] **Step 2: Install vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 3: Write the failing tests**

```ts
// lib/phenotype-engine.test.ts
import { describe, expect, it } from "vitest";
import { rng, mean, sd, median, quantile, ari, makeCohort, qualityReport, buildFeatures, cluster, metrics, bootstrap, profile, runClassifier, ACTIVE, TIMEPOINTS } from "./phenotype-engine";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = rng(42), b = rng(42);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("produces values in [0,1)", () => {
    const r = rng(1);
    for (let i = 0; i < 50; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe("summary stats", () => {
  it("computes mean/sd/median/quantile on a known array", () => {
    const a = [1, 2, 3, 4, 5];
    expect(mean(a)).toBe(3);
    expect(median(a)).toBe(3);
    expect(sd(a)).toBeCloseTo(Math.sqrt(2), 5);
    expect(quantile(a, 0.5)).toBe(3);
  });
});

describe("ari", () => {
  it("is 1 for identical labelings", () => {
    const lab = [0, 0, 1, 1, 2, 2, 0, 1, 2];
    expect(ari(lab, lab)).toBeCloseTo(1, 6);
  });
  it("is low for a permutation-scrambled random relabeling of a different partition", () => {
    const a = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const b = [0, 1, 2, 0, 1, 2, 0, 1, 2]; // orthogonal partition
    expect(ari(a, b)).toBeLessThan(0.2);
  });
});

describe("makeCohort", () => {
  it("is deterministic and produces the requested N", () => {
    const c1 = makeCohort(300, 20260913);
    const c2 = makeCohort(300, 20260913);
    expect(c1.n).toBe(300);
    expect(c1.participants).toHaveLength(300);
    expect(c1.participants[0]).toEqual(c2.participants[0]);
    expect(c1.participants[0].obs).toHaveLength(TIMEPOINTS.length);
  });
});

describe("qualityReport", () => {
  it("returns one grid cell per timepoint", () => {
    const cohort = makeCohort(300, 1);
    const q = qualityReport(cohort);
    expect(q.grid).toHaveLength(TIMEPOINTS.length);
    expect(q.completeBaseline + q.incompleteBaseline).toBe(cohort.n);
  });
});

describe("buildFeatures", () => {
  it("z-scores every column to mean~0, sd~1", () => {
    const cohort = makeCohort(300, 7);
    const feat = buildFeatures(cohort, "full", "impute", ACTIVE.map((m) => m.id));
    for (let j = 0; j < feat.names.length; j++) {
      const col = feat.Z.map((row) => row[j]);
      expect(mean(col)).toBeCloseTo(0, 5);
      expect(sd(col)).toBeCloseTo(1, 5);
    }
  });
});

describe("cluster + metrics", () => {
  it("kmeans assigns every row to a valid cluster id, and metrics are in range", () => {
    const cohort = makeCohort(300, 3);
    const feat = buildFeatures(cohort, "full", "impute", ACTIVE.map((m) => m.id));
    const lab = cluster(feat.Z, "kmeans", 4, 7)!;
    expect(lab).toHaveLength(feat.Z.length);
    lab.forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(4); });
    const m = metrics(feat.Z, lab, 4);
    expect(m.silhouette).toBeGreaterThanOrEqual(-1);
    expect(m.silhouette).toBeLessThanOrEqual(1);
    expect(m.sizes.reduce((a, b) => a + b, 0)).toBe(feat.Z.length);
  });
  it("hierarchical and gmm also return valid labelings", () => {
    const cohort = makeCohort(300, 3);
    const feat = buildFeatures(cohort, "full", "impute", ACTIVE.map((m) => m.id));
    for (const algo of ["hier", "gmm"] as const) {
      const lab = cluster(feat.Z, algo, 3, 7)!;
      expect(lab).toHaveLength(feat.Z.length);
    }
  });
});

describe("bootstrap", () => {
  it("runs the requested number of iterations", () => {
    const cohort = makeCohort(300, 3);
    const feat = buildFeatures(cohort, "full", "impute", ACTIVE.map((m) => m.id));
    const b = bootstrap(feat.Z, "kmeans", 4, 10, 99)!;
    expect(b.iters).toBe(10);
    expect(b.perCluster).toHaveLength(4);
  });
});

describe("profile + runClassifier", () => {
  it("profile returns one entry per cluster with one domain per enabled measure", () => {
    const cohort = makeCohort(300, 3);
    const enabled = ACTIVE.map((m) => m.id);
    const feat = buildFeatures(cohort, "full", "impute", enabled);
    const lab = cluster(feat.Z, "kmeans", 3, 7)!;
    const profs = profile(cohort, feat, lab, 3, enabled);
    expect(profs).toHaveLength(3);
    expect(profs[0].domains).toHaveLength(enabled.length);
  });
  it("runClassifier returns accuracy metrics in [0,1] and a k*k confusion matrix", () => {
    const cohort = makeCohort(300, 3);
    const enabled = ACTIVE.map((m) => m.id);
    const feat = buildFeatures(cohort, "full", "impute", enabled);
    const lab = cluster(feat.Z, "kmeans", 3, 7)!;
    const r = runClassifier(cohort, feat, lab, 3, "m2", "logreg", 21, enabled)!;
    expect(r.accuracy).toBeGreaterThanOrEqual(0);
    expect(r.accuracy).toBeLessThanOrEqual(1);
    expect(r.cm).toHaveLength(3);
    expect(r.cm[0]).toHaveLength(3);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `lib/phenotype-engine.ts` does not exist yet.

- [ ] **Step 5: Port `lib/phenotype-engine.ts`**

Port the fetched `phenotype-engine.js` (full source already read this session — synthetic cohort generator, `qualityReport`, `FEATURE_SETS`/`buildFeatures`, `kmeans`/`hierarchical`/`gmm` + `ALGORITHMS`, `metrics`, `ari`, `bootstrap`, `profile`, `EARLY_MODELS`/`CLASSIFIERS` (`logreg`/`forest`) + `runClassifier`, `CLUSTER_COLORS`) to TypeScript almost verbatim — same algorithms, same constants (`BASE`, `DROP`, `NOISE`, seeded fault injection in `makeCohort`), only adding parameter/return types from `lib/types.ts` and converting the two seeded data-quality-fault lines that reference `participants[102]`/`participants[138]`/`participants[203]` unchanged (these indices are load-bearing for the Dashboard's "Flagged records" table). Do not alter any numeric constant, loop bound, or formula — reproducibility depends on it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all suites green).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/phenotype-engine.ts lib/phenotype-engine.test.ts vitest.config.ts package.json package-lock.json
git commit -m "Port phenotype-engine to TypeScript with unit tests"
```

---

### Task 2: Glossary + info-tooltip system

**Files:**
- Create: `lib/glossary.ts`
- Create: `components/platform/InfoTip.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `GLOSSARY: Record<string, { t: string; b: string; r?: string; h?: string }>`; `InfoTipProvider` (context provider, wraps the whole platform); `<Info id="silhouette" />` (the "i" trigger button — renders `<button class="info" aria-expanded aria-label onMouseEnter onMouseLeave onClick>`, reading/writing tooltip state via context); the floating tooltip panel itself, rendered once by `InfoTipProvider`.

- [ ] **Step 1: Write `lib/glossary.ts`**

Port the `GLOSSARY` object verbatim from the script (lines 964–1035 of the source — every one of the ~70 terms: `synthetic`, `phenotype`, `cluster`, `trajectory`, `k`, `algorithm`, `feature`, `imputation`, `missingness`, `participant_missing`, `baseline_complete`, `flags`, `item_level`, `item_missing`, `raw_score`, `normalised`, `nprs`, `odi`, `sts`, `fabq`, `direction`, `alignment`, `timepoint`, `window`, `seed`, `cluster_quality`, `silhouette`, `ch`, `db`, `wss`, `cluster_size`, `bootstrap`, `cluster_stability`, `iterations`, `ari`, `kappa`, `cramer`, `sensitivity`, `conventional`, `provisional`, `phenotype_run`, `ground_truth`, `population_view`, `iqr`, `ci`, `classifier`, `early_window`, `target`, `split`, `held_out`, `accuracy`, `balanced`, `macro_f1`, `confusion`, `per_class`, `recall`, `precision`, `specificity`, `f1`, `calibration`, `confidence`, `symptom_duration`, `load`, `site`, `study_id`, `eligibility`, `consent`, `bmi_derived`, `schedule`, `analysis_record` — copy every `t`/`b`/`r`/`h` field exactly, no paraphrasing).

- [ ] **Step 2: Write `components/platform/InfoTip.tsx`**

```tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

interface TipState { id: string; left: number; top: number; pinned: boolean; }
interface InfoTipContextValue {
  tip: TipState | null;
  show: (id: string, el: HTMLElement) => void;
  pin: (id: string, el: HTMLElement) => void;
  close: () => void;
}
const InfoTipContext = createContext<InfoTipContextValue | null>(null);

export function InfoTipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const tipRef = useRef(tip);
  tipRef.current = tip;

  const place = useCallback((id: string, el: HTMLElement, pinned: boolean) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(10, Math.min(r.left - 8, window.innerWidth - 300));
    const below = r.bottom + 10;
    const top = below + 190 > window.innerHeight ? Math.max(10, r.top - 200) : below;
    setTip({ id, left: Math.round(left), top: Math.round(top), pinned });
  }, []);

  const show = useCallback((id: string, el: HTMLElement) => {
    if (!(tipRef.current && tipRef.current.pinned)) place(id, el, false);
  }, [place]);

  const pin = useCallback((id: string, el: HTMLElement) => {
    const t = tipRef.current;
    if (t && t.id === id && t.pinned) setTip(null);
    else place(id, el, true);
  }, [place]);

  const close = useCallback(() => {
    if (!(tipRef.current && tipRef.current.pinned)) setTip(null);
  }, []);

  const closeAlways = useCallback(() => setTip(null), []);

  useEffect(() => {
    document.addEventListener("click", closeAlways);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAlways(); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeAlways, true);
    return () => {
      document.removeEventListener("click", closeAlways);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeAlways, true);
    };
  }, [closeAlways]);

  const g = tip ? GLOSSARY[tip.id] : null;

  return (
    <InfoTipContext.Provider value={{ tip, show, pin, close }}>
      {children}
      {tip && g && (
        <div style={{ position: "fixed", left: tip.left, top: tip.top, width: 288, zIndex: 60, background: "var(--color-bg)", border: "2px solid var(--color-text)", boxShadow: "var(--shadow-lg)", padding: "13px 14px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div className="lbl" style={{ color: "var(--color-accent-700)" }}>{g.t}</div>
            <span className="lbl mono" style={{ whiteSpace: "nowrap" }}>{g.h || ""}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "7px 0 0", textWrap: "pretty" }}>{g.b}</p>
          {g.r && (
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--color-divider)" }}>
              <div className="lbl">How to read it here</div>
              <p style={{ fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" }}>{g.r}</p>
            </div>
          )}
        </div>
      )}
    </InfoTipContext.Provider>
  );
}

export function Info({ id }: { id: keyof typeof GLOSSARY }) {
  const ctx = useContext(InfoTipContext);
  if (!ctx) throw new Error("Info must be used within InfoTipProvider");
  const { tip, show, pin, close } = ctx;
  const g = GLOSSARY[id];
  const isOpen = tip?.id === id;
  return (
    <button
      type="button"
      className="info"
      aria-expanded={isOpen}
      aria-label={`What is ${g.t}?`}
      onMouseEnter={(e) => show(id, e.currentTarget)}
      onMouseLeave={close}
      onClick={(e) => { e.stopPropagation(); pin(id, e.currentTarget); }}
    >
      i
    </button>
  );
}
```

- [ ] **Step 3: Verify**

Temporarily render `<InfoTipProvider><Info id="silhouette" /></InfoTipProvider>` in the Task 0 placeholder page. Run: `npm run dev`. Expected: an "i" button; hovering shows the tooltip near the button; clicking pins it (stays open after mouse leaves); clicking elsewhere on the page closes it; Escape closes it. Then remove the temporary render (Task 3 wires it into the real Nav/screens).

- [ ] **Step 4: Commit**

```bash
git add lib/glossary.ts components/platform/InfoTip.tsx
git commit -m "Add glossary data and info-tooltip system"
```

---

### Task 3: Platform shell — state container + Nav

**Files:**
- Modify: `components/platform/RecoveryPhenotypingPlatform.tsx` (replace placeholder)
- Create: `components/platform/Nav.tsx`
- Create: `lib/download.ts`

**Interfaces:**
- Consumes: `InfoTipProvider` (Task 2), `phenotype-engine` exports (Task 1), `PlatformState` shape (defined above).
- Produces: the `RecoveryPhenotypingPlatform` default export; internal `state`/`setState`-equivalent (`useState<PlatformState>`); `recompute()`, `runClf()`, `runBoot()`, `runSensitivity()` functions (bodies filled in during Tasks 9/11/13 once their consuming screens exist, but their signatures and state-shape must be correct now since every later screen task calls them); a `screen: ScreenId` switch rendering one of the 9 screen components (stubbed as `<div>{screen} — TODO</div>` until each screen's task lands); `<Nav />` rendered above the switch, `<AnalysisRecordDrawer />` stubbed until Task 13.

- [ ] **Step 1: Write `lib/download.ts`**

```ts
export function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
```

- [ ] **Step 2: Write `components/platform/Nav.tsx`**

Port the `<nav class="nav">` block (source lines 45–52) plus the synthetic-data-mode banner (lines 54–58): brand mark "RE:PHENO" + "MSK recovery phenotyping · MVP" sublabel, a `<button class="navbtn" aria-current>` per `SCREENS` entry (`dashboard`/Dashboard, `enrol`/Enrolment, `participants`/Participants, `entry`/Assessment, `measures`/Measures, `discovery`/Discovery, `solutions`/Solutions, `profiles`/Profiles, `classify`/Classification), an "Analysis record" `btn-secondary` that opens the drawer, and below it the `SYNTHETIC DATA MODE` tag + explanatory line + `dataset {version} · seed {seed}` on the right. Props: `{ screen: ScreenId; onNavigate: (s: ScreenId) => void; onOpenRecord: () => void; datasetVersion: string; seed: number }`.

- [ ] **Step 3: Write `RecoveryPhenotypingPlatform.tsx`** (state + mount + shell)

Set up `useState<PlatformState>` with the exact initial state from the source (`ENROL_DEFAULT`, `entry` defaults, `algo:'kmeans'`, `featureSet:'full'`, `missing:'impute'`, `k:4`, `seed:20260913`, `enabled:['nprs','odi','sts','fabq']`, etc. — source lines 952–1054). In a mount `useEffect`, dynamically `import("@/lib/phenotype-engine")`, call `makeCohort(300, seed)`, `qualityReport(cohort)`, set `ready:true`, then call `recompute()`. Wrap the whole tree in `<InfoTipProvider>`. Render `<Nav .../>`, the active screen (switch on `state.screen`, each case a stub `<div>` for now), and a stub for the record drawer. Leave `recompute`/`runClf`/`runBoot`/`runSensitivity` as function declarations with the exact bodies from source lines 1099–1181 (these don't depend on any screen component, only on engine + state, so they can be fully implemented now, not stubbed).

- [ ] **Step 4: Verify**

Run: `npm run dev`. Expected: Nav renders with all 9 tabs and the synthetic-data banner; clicking a tab switches the stub content; "Analysis record" button is present (drawer stub can be a no-op for now); no console errors; after a brief moment the cohort/engine load completes (add a temporary `console.log` of `state.ready` or check via React DevTools, remove before commit).

- [ ] **Step 5: Commit**

```bash
git add components/platform/RecoveryPhenotypingPlatform.tsx components/platform/Nav.tsx lib/download.ts
git commit -m "Add platform state container, mount lifecycle, and nav shell"
```

---

### Task 4: Dashboard screen

**Files:**
- Create: `components/platform/screens/DashboardScreen.tsx`
- Create: `components/platform/charts/Heatmap.tsx`
- Modify: `components/platform/RecoveryPhenotypingPlatform.tsx` (wire the `dashboard` case, compute its `V` slice)

**Interfaces:**
- Consumes: `state.quality` (`QualityReport`), `state.cohort`, `state.run`/`sweep[k]`, `state.boot`, `state.clf`, `state.solutions`/`provisional`, `<Info id/>`.
- Produces: nothing consumed by later tasks (leaf screen), but establishes the "compute `V` in the parent, pass down as props" pattern every later screen task follows.

- [ ] **Step 1: Write `Heatmap.tsx`**

Generic missingness-grid SVG: props `{ cols: {label:string}[]; rows: {label:string}[]; cells: {r:number;c:number; pct:number; text:string}[] }`, replicate the geometry from source lines 1264–1283 (`cw=72, chh=30, mx0=92, my0=30`, cell `fillOpacity = min(0.92, 0.06 + pct/26)`, ink flips to `#f3f2f2` when `pct>12`).

- [ ] **Step 2: Write `DashboardScreen.tsx`**

Port source lines 61–158 (`isDashboard` block: "Study status" h1, "Recruitment and follow-up" 3-col grid of `tpCards` bars, the missingness `Heatmap` + CSV export button, "Flagged records" table over `quality.flags`, 3-up complete/incomplete-baseline/mean-missingness tiles, "Analysis status" 6-tile grid for algo name/feature line, K/smallest, silhouette/DB, bootstrap stability, classifier accuracy, provisional solution). Field mapping (all computed in the parent, from source lines 1254–1304):
- `tpCards`: one per `TIMEPOINTS`, `{label, n: quality.grid[i].assessed, pct, pctLabel}`.
- `quality`: `{completeBaseline, incompleteBaseline, pMissLabel: pct1(participantMissingness.mean)}`.
- `flags`: `quality.flags` directly.
- `status`: `{algoName, featureLine, smallest, sil, db, stability, stabilityNote, clfAcc, clfNote, provisional, provisionalNote}` — exact formulas at source lines 1285–1296.
- `exportQuality`: CSV of measure × timepoint present/missing/pct — source lines 1297–1304, using `download()` from Task 3.

- [ ] **Step 3: Wire into the parent**

In `RecoveryPhenotypingPlatform.tsx`, replace the `dashboard` stub with `<DashboardScreen V={...} />`, computing the `V` slice inline (or via a `useMemo` keyed on the relevant state fields).

- [ ] **Step 4: Verify**

Run: `npm run dev`, navigate to Dashboard. Expected: 3 recruitment bars (T0 at 100%, later timepoints lower per configured dropout), a red-shaded heatmap with 4 rows (NPRS/ODI/5xSTS/FABQ-PA) × 6 columns, 6 flagged rows in the table, "Export quality report (CSV)" downloads a file. Hover an "i" icon — tooltip appears (confirms Task 2 wiring end-to-end).

- [ ] **Step 5: Commit**

```bash
git add components/platform/screens/DashboardScreen.tsx components/platform/charts/Heatmap.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Dashboard screen"
```

---

### Task 5: Enrolment screen

**Files:**
- Create: `components/platform/screens/EnrolmentScreen.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `enrol` case + `enrolVals()`/`setEnrol()`)

Port source lines 161–279 (form) and the `enrolVals()`/`setEnrol()` methods (lines 1715–1774) verbatim: study ID/date/site segmented control, inclusion/exclusion criteria yes/no cell-buttons (`INCLUSION`/`EXCLUSION` arrays, lines 952–953), baseline characteristics inputs (age/height/weight/duration/episodes, sex/occupational-loading segmented controls), consent panel, derived BMI/duration-class/eligibility tiles, generated visit schedule table, the "what is written to the database" payload preview (`enrol.payload` string template), and the Enrol/Reset buttons (`enrol()` navigates to `entry` screen; disabled until `eligible && consent`).

- [ ] **Step 1: Implement `EnrolmentScreen.tsx` + parent wiring** (exact field list above; this is one cohesive form, not worth sub-splitting further)
- [ ] **Step 2: Verify** — Run `npm run dev`, go to Enrolment. Change age to 85: status flips to "Not eligible", "Enrol" button stays disabled. Answer all inclusion=yes/exclusion=no and check consent: status flips to "Eligible", button enables; click it → navigates to Assessment screen. Payload preview text updates live as fields change.
- [ ] **Step 3: Commit**

```bash
git add components/platform/screens/EnrolmentScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Enrolment screen"
```

---

### Task 6: Assessment entry screen

**Files:**
- Create: `components/platform/screens/AssessmentEntryScreen.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `entry` case + `entryVals()`/`setEntry()`)

Port source lines 384–467 (form) and `entryVals()`/`setEntry()` (lines 1776–1810): NPRS slider, 5×STS slider, FABQ-PA 4-item cell-button grid (`FABQ_ITEMS`, line 956), ODI 10-item cell-button grid (`ODI_ITEMS`, line 955, 0–5 + "—" not-answered), raw/normalised/missing-items tiles with valid/invalid status (≤2 missing sections = valid, pro-rated), the payload preview, and disabled Save/working Reset buttons.

- [ ] **Step 1: Implement + wire**
- [ ] **Step 2: Verify** — Move the NPRS slider: value updates live. Set 3+ ODI sections to "—": status flips to "Invalid". Payload preview reflects current item values.
- [ ] **Step 3: Commit**

```bash
git add components/platform/screens/AssessmentEntryScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Assessment entry screen"
```

---

### Task 7: Measures screen

**Files:**
- Create: `components/platform/screens/MeasuresScreen.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `measures` case + `measureRows`/`alignCards`/`tpRows`)

Port source lines 468–527 and the corresponding `V` fields at lines 1410–1439: the measure table (`MEASURES`, with per-row direction radios that mutate `m.dir` in place and call `recompute()`, and an add/remove toggle gated at "at least 2 enabled" — `S.enabled.length < 2` blocks removal), the "Direction alignment" card grid (`alignCards`), and the "Timepoint schedule" table (`tpRows`, window = `±3 days` for weeks ≤4 else `±7 days`).

**Note:** `m.dir = v` mutates the shared `Measure` object from `phenotype-engine.ts` module state directly (matching the source, which does the same on the imported `E.MEASURES` array) — this is a deliberate port of the original's behavior, not a new mutation to introduce elsewhere.

- [ ] **Step 1: Implement + wire**
- [ ] **Step 2: Verify** — Toggle FABQ-PA's direction radio: triggers a recompute (brief "recomputing…" busy note elsewhere in the UI). Try removing measures until only 1 remains enabled: the last toggle button becomes disabled.
- [ ] **Step 3: Commit**

```bash
git add components/platform/screens/MeasuresScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Measures screen"
```

---

### Task 8: Participants screen

**Files:**
- Create: `components/platform/screens/ParticipantsScreen.tsx`
- Create: `components/platform/charts/TrajectoryPanel.tsx`
- Create: `components/platform/charts/PopulationChart.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `participants` case)

Port source lines 280–383 and `V` fields at lines 1306–1401: roster list (filterable by study ID, `query`), per-participant meta + risk/cluster tags, the 4-panel per-measure trajectory grid (`panels`, via `TrajectoryPanel`: individual red line + cohort dashed mean + IQR band + hollow-square gap markers), and the population-level chart (`pop`, via `PopulationChart`: domain/view segmented controls, spaghetti lines colored by cluster, mean+CI band, median dashed line). Both charts share the `gx/gy/ticks` helpers — put those in `lib/svg-chart.ts` now (used again in Tasks 9/11/12) along with the `T(...)` SVG-label builder (source line 1040).

- [ ] **Step 1: Write `lib/svg-chart.ts`** (`gx`, `gy`, `ticks`, `T` — signatures from source lines 1192–1194, 1040)
- [ ] **Step 2: Write `TrajectoryPanel.tsx` + `PopulationChart.tsx` + `ParticipantsScreen.tsx`, wire into parent**
- [ ] **Step 3: Verify** — Type a study ID fragment in the filter box: roster narrows. Click a roster row: the 4 trajectory panels and header meta update to that participant. Switch the population view segmented control between Individuals/Mean+CI/Both: spaghetti lines and the mean band toggle accordingly.
- [ ] **Step 4: Commit**

```bash
git add lib/svg-chart.ts components/platform/charts/TrajectoryPanel.tsx components/platform/charts/PopulationChart.tsx components/platform/screens/ParticipantsScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Participants screen with trajectory and population charts"
```

---

### Task 9: Discovery screen

**Files:**
- Create: `components/platform/screens/DiscoveryScreen.tsx`
- Create: `components/platform/charts/MetricLineChart.tsx`
- Create: `components/platform/charts/HBarList.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `discovery` case)

Port source lines 530–626 and `V` fields at lines 1441–1518: feature-set/algorithm/missing-strategy radio groups (each `onChange` calls `recompute()`), K slider (2–8) and seed field, the 4 cluster-quality-vs-K charts (silhouette/Calinski-Harabasz/Davies-Bouldin/WSS — `metricCharts`, each an instance of `MetricLineChart` with the current-K point highlighted in accent color), cluster-size bars at current K (`sizeBars`, via `HBarList`), the "variables entering this run" chip list, and "add to comparison"/"export features" buttons.

- [ ] **Step 1: Write `MetricLineChart.tsx`** (props: `{title, hint, infoId, ks:number[], values:number[], selectedK:number, decimals:number}`, geometry from source lines 1475–1495)
- [ ] **Step 2: Write `HBarList.tsx`** (props: `{rows: {label:string; pct:number; value:string; color?:string}[]}` — reused by Tasks 10 and 11)
- [ ] **Step 3: Write `DiscoveryScreen.tsx`, wire into parent**
- [ ] **Step 4: Verify** — Move the K slider: all 4 charts' highlighted point moves, cluster-size bars update. Switch algorithm to "Gaussian mixture": charts recompute (brief busy state). Click "Add this solution to comparison": navigates to Solutions with a new row.
- [ ] **Step 5: Commit**

```bash
git add components/platform/charts/MetricLineChart.tsx components/platform/charts/HBarList.tsx components/platform/screens/DiscoveryScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Discovery screen with cluster-quality charts"
```

---

### Task 10: Solutions screen

**Files:**
- Create: `components/platform/screens/SolutionsScreen.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `solutions` case)

Port source lines 628–701 and `V` fields at lines 1520–1563: the kept-solutions table (mark-provisional toggle highlights the row), the sensitivity analysis panel (`sensRows` via `HBarList`, `runSensitivity()` already implemented in Task 3), and the conventional-vs-derived cross-tabulation (`crossRows`/`crossCols`, Cohen's κ / ARI / Cramér's V tiles — formulas at lines 1538–1563).

- [ ] **Step 1: Implement + wire**
- [ ] **Step 2: Verify** — With at least one solution added (from Task 9), mark it provisional: row highlights, label flips to "provisional ✓". Click "Run sensitivity analysis": bars populate after a brief delay. Cross-tab table and κ/ARI/V tiles render (only once a run with `lab` exists).
- [ ] **Step 3: Commit**

```bash
git add components/platform/screens/SolutionsScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Solutions comparison screen"
```

---

### Task 11: Profiles screen

**Files:**
- Create: `components/platform/screens/ProfilesScreen.tsx`
- Create: `components/platform/charts/ClusterTrajectoryChart.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `profiles` case)

Port source lines 703–792 and `V` fields at lines 1565–1622: one card per cluster (`clusters`, via `ClusterTrajectoryChart` for the standardised-trajectory SVG + a researcher-interpretation free-text input + per-cluster bootstrap-stability readout), the bootstrap-resampling panel (`boot`, via `HBarList` for per-cluster bars — `runBoot()` already implemented in Task 3), and the "recovery of known synthetic patterns" ground-truth cross-tab (`truthRows`/`truthCols`/`truthARI`, only in synthetic mode).

- [ ] **Step 1: Write `ClusterTrajectoryChart.tsx`** (geometry from source lines 1568–1596, including the label de-overlap pass at line 1590–1591)
- [ ] **Step 2: Implement `ProfilesScreen.tsx`, wire into parent**
- [ ] **Step 3: Verify** — One card per current-K cluster, each with n/%/age/sex/BMI/duration, per-domain shape descriptions, and a trajectory chart. Type into a cluster's interpretation field: value persists (stored in `state.notes`). Click "Run bootstrap": per-cluster stability bars and the 3 summary tiles populate. Ground-truth table shows 4 pattern rows × K columns.
- [ ] **Step 4: Commit**

```bash
git add components/platform/charts/ClusterTrajectoryChart.tsx components/platform/screens/ProfilesScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Cluster profiles screen"
```

---

### Task 12: Classification screen

**Files:**
- Create: `components/platform/screens/ClassificationScreen.tsx`
- Create: `components/platform/charts/ConfusionMatrix.tsx`
- Create: `components/platform/charts/CalibrationCurve.tsx`
- Modify: `RecoveryPhenotypingPlatform.tsx` (wire `classify` case)

Port source lines 794–896 and `V` fields at lines 1624–1680: early-model selector (`modelOpts`, baseline-only / +week2 / +week4), classifier radio group (logreg/random-forest, gradient-boosting shown disabled as an "adapter slot"), accuracy/balanced-accuracy/macro-F1 tiles, the confusion matrix (`cm`, via `ConfusionMatrix`), per-cluster precision/recall/specificity/F1 table, the calibration curve (`cal`, via `CalibrationCurve`), the held-out predictions table (`clf.cases`), and the fixed "scope of the output" disclaimer box (verbatim copy, source lines 890–893).

- [ ] **Step 1: Write `ConfusionMatrix.tsx`** (geometry from source lines 1642–1662) and `CalibrationCurve.tsx` (lines 1663–1679)
- [ ] **Step 2: Implement `ClassificationScreen.tsx`, wire into parent**
- [ ] **Step 3: Verify** — Switch between the 3 early models: accuracy figures and confusion matrix recompute (cached per `[k, model, clf, run-spec]` key per `runClf()`'s memoization — confirm re-selecting a previously-computed model is instant, matching source lines 1119–1120). Switch classifier to random forest: recomputes. Calibration curve renders 5 dots against the diagonal.
- [ ] **Step 4: Commit**

```bash
git add components/platform/charts/ConfusionMatrix.tsx components/platform/charts/CalibrationCurve.tsx components/platform/screens/ClassificationScreen.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement Early classification screen"
```

---

### Task 13: Analysis record drawer + CSV exports

**Files:**
- Create: `components/platform/AnalysisRecordDrawer.tsx` (replace Task 3 stub)
- Modify: `RecoveryPhenotypingPlatform.tsx` (implement `exportRaw`/`exportClusters`/`exportPerf`, wire the `record`/`exports` arrays)

Port source lines 900–930 (drawer markup) and lines 1682–1711 + 1812–1838 (`record` field list, `exports` button list, `exportRaw`/`exportClusters`/`exportPerf`). The drawer is a right-side slide-over: a 17-row key/value record table (dataset version, run timestamp, algorithm+hyperparameters, seed, K, preprocessing, missing-data method, feature construction, measures included, analysed sample, validation, sensitivity, classifier, provisional solution, researcher interpretations count, environment) and 8 export buttons (raw/clean/feature/cluster/quality/model-performance CSVs enabled, figures/report disabled placeholders per source — those two stay disabled, that's in the original spec, not a gap in this port).

- [ ] **Step 1: Implement + wire**
- [ ] **Step 2: Verify** — Open the drawer from any screen. Confirm all 17 rows render sensible values (not "—" once a run exists). Click each enabled export button and confirm a CSV downloads with a sensible filename (`raw-dataset-synthetic-v4.csv`, `analytical-dataset-synthetic-v4.csv`, `features-k4-kmeans.csv`, `cluster-assignments-k4-kmeans.csv`, `data-quality-synthetic-v4.csv`, `model-performance-m2-logreg.csv`). Figures/Analysis report buttons stay disabled.
- [ ] **Step 3: Commit**

```bash
git add components/platform/AnalysisRecordDrawer.tsx components/platform/RecoveryPhenotypingPlatform.tsx
git commit -m "Implement analysis record drawer and CSV exports"
```

---

### Task 14: Final integration pass

**Files:** none new — verification + cleanup only.

- [ ] **Step 1: Full click-through** — `npm run dev`, visit all 9 screens in nav order, open/close the record drawer, hover and pin at least 3 different "i" tooltips (including one that has an `r` "how to read it here" section and one that doesn't, to confirm the conditional render), resize the window to confirm `auto-fit`/`minmax` grids reflow reasonably at narrower widths.
- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all `phenotype-engine` tests pass.

- [ ] **Step 4: Production build sanity check**

Run: `npm run build`
Expected: builds successfully (confirms no server/client-boundary mistakes — the whole platform tree is client-rendered, but this still catches type errors and static-analysis issues the dev server tolerates).

- [ ] **Step 5: Commit** (only if Steps 1–4 turned up fixes)

```bash
git add -A
git commit -m "Fix integration issues found in full click-through"
```

---

## Self-Review

**Spec coverage:** All 9 `sc-if` screens (dashboard/enrol/participants/entry/measures/discovery/solutions/profiles/classify — Tasks 4–12), the record drawer (Task 13), the tooltip/glossary system (Task 2), the design system + font (Task 0), and the full analysis engine with the two duplicated `ari()` implementations in the source (engine-level and a `Component.ari` method) collapsed into the single engine export used everywhere (Task 1) are all covered. The `_ds_bundle.js` is an empty stub (verified its content this session — no components registered) and `support.js`/the dc-runtime are Claude Design preview tooling; neither is ported, per the Architecture section.

**Placeholder scan:** No task contains "TBD"/"handle appropriately"/unfilled code blocks. Tasks 5–13 intentionally reference "port source lines X–Y" with the exact field lists rather than re-pasting the original markup, because the executor (this session) already holds that source in context — this is a deliberate scope reduction for an inline self-executed plan, not a placeholder; it's called out explicitly in the plan header.

**Type consistency:** `PlatformState`/`RunState`/`SolutionRecord`/`EnrolState`/`EntryState` defined once in the Interfaces section and referenced by name (not redefined differently) in every later task. Function names (`recompute`, `runClf`, `runBoot`, `runSensitivity`, `download`, `Info`, `InfoTipProvider`) are introduced once (Tasks 2–3) and only referenced, never renamed, afterward.
