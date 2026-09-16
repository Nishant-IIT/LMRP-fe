// Shared data shapes for the Recovery Phenotyping Platform — the synthetic
// cohort, the analysis engine's outputs, and the view-model each screen reads.

export type MeasureId = "nprs" | "odi" | "sts" | "fabq" | "pseq" | "tug";

export interface Timepoint {
  id: string;
  label: string;
  short: string;
  week: number;
}

export interface Measure {
  id: MeasureId;
  domain: string;
  name: string;
  full: string;
  min: number;
  max: number;
  dir: "worse" | "better";
  items: number;
  unit?: string;
  active: boolean;
}

export interface Pattern {
  id: number;
  name: string;
  share: number;
  curves: Record<string, number[]>;
}

export interface Observation {
  tp: string;
  missing: boolean;
  values: Partial<Record<MeasureId, number | null>>;
  complete?: number;
  itemsMissing?: number;
}

export interface Participant {
  sid: string;
  pattern: number;
  age: number;
  sex: "F" | "M";
  bmi: number;
  durationWeeks: number;
  episodes: number;
  conventional: "low" | "moderate" | "high";
  site: string;
  obs: Observation[];
}

export interface QualityFlag {
  sid: string;
  tp: string;
  kind: string;
  detail: string;
}

export interface Cohort {
  participants: Participant[];
  flags: QualityFlag[];
  n: number;
  seed: number;
  version: string;
}

export interface QualityCellByMeasure {
  present: number;
  missing: number;
}

export interface QualityGridCell {
  tp: string;
  assessed: number;
  missingAssessment: number;
  byMeasure: Partial<Record<MeasureId, QualityCellByMeasure>>;
}

export interface QualityReport {
  grid: QualityGridCell[];
  pctMissing: Partial<Record<MeasureId, number>>;
  completeBaseline: number;
  incompleteBaseline: number;
  flags: QualityFlag[];
  participantMissingness: { mean: number; max: number; noneMissing: number };
  overall: number;
}

export interface FeatureSet {
  id: string;
  name: string;
  blocks: string[];
}

export interface Features {
  names: string[];
  Z: number[][];
  keep: number[];
  nDropped: number;
  setName: string;
  used: string[];
}

export interface Algorithm {
  id: string;
  name: string;
  note: string;
  run: ((Z: number[][], k: number, seed?: number) => number[]) | null;
}

export interface ClusterMetrics {
  k: number;
  sizes: number[];
  silhouette: number;
  ch: number;
  db: number;
  wss: number;
  smallest: number;
  smallestPct: number;
}

export interface BootstrapResult {
  iters: number;
  meanARI: number;
  sdARI: number;
  lowARI: number;
  highARI: number;
  perCluster: number[];
}

export interface TrajPoint {
  tp: string;
  short: string;
  week: number;
  n: number;
  mean: number | null;
  lo: number | null;
  hi: number | null;
}

export interface DomainProfile {
  measure: Measure;
  traj: TrajPoint[];
  relChange: number;
  earlyShare: number;
  shape: string;
}

export interface ClusterProfile {
  c: number;
  label: string;
  n: number;
  pct: number;
  age: number;
  female: number;
  bmi: number;
  duration: number;
  domains: DomainProfile[];
  convCounts: { low: number; moderate: number; high: number };
  truth: number[];
  members: Participant[];
}

export interface EarlyModel {
  id: string;
  name: string;
  info: string;
  upTo: number;
}

export interface Classifier {
  id: string;
  name: string;
  note: string;
  run:
    | ((
        Xtr: number[][],
        ytr: number[],
        Xte: number[][],
        k: number,
        seed?: number
      ) => number[][])
    | null;
}

export interface PerClassMetric {
  c: number;
  n: number;
  prec: number;
  rec: number;
  spec: number;
  f1: number;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  conf: number;
  acc: number;
}

export interface SampleCase {
  sid: string;
  pred: number;
  conf: number;
}

export interface ClassifierResult {
  nFeatures: number;
  nTrain: number;
  nTest: number;
  cm: number[][];
  perClass: PerClassMetric[];
  bins: CalibrationBin[];
  accuracy: number;
  balanced: number;
  macroF1: number;
  meanConfidence: number;
  sampleCases: SampleCase[];
}
