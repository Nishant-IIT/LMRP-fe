import { describe, expect, it } from "vitest";
import {
  rng,
  mean,
  sd,
  median,
  quantile,
  ari,
  makeCohort,
  qualityReport,
  buildFeatures,
  cluster,
  metrics,
  bootstrap,
  profile,
  runClassifier,
  ACTIVE,
  TIMEPOINTS,
} from "./phenotype-engine";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = rng(42),
      b = rng(42);
    const seqA = [a(), a(), a()],
      seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("produces values in [0,1)", () => {
    const r = rng(1);
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
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
  it("is low for an orthogonal partition", () => {
    const a = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const b = [0, 1, 2, 0, 1, 2, 0, 1, 2];
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
    const feat = buildFeatures(
      cohort,
      "full",
      "impute",
      ACTIVE.map((m) => m.id)
    );
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
    const feat = buildFeatures(
      cohort,
      "full",
      "impute",
      ACTIVE.map((m) => m.id)
    );
    const lab = cluster(feat.Z, "kmeans", 4, 7)!;
    expect(lab).toHaveLength(feat.Z.length);
    lab.forEach((c) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(4);
    });
    const m = metrics(feat.Z, lab, 4);
    expect(m.silhouette).toBeGreaterThanOrEqual(-1);
    expect(m.silhouette).toBeLessThanOrEqual(1);
    expect(m.sizes.reduce((a, b) => a + b, 0)).toBe(feat.Z.length);
  });

  it("hierarchical and gmm also return valid labelings", () => {
    const cohort = makeCohort(300, 3);
    const feat = buildFeatures(
      cohort,
      "full",
      "impute",
      ACTIVE.map((m) => m.id)
    );
    for (const algo of ["hier", "gmm"] as const) {
      const lab = cluster(feat.Z, algo, 3, 7)!;
      expect(lab).toHaveLength(feat.Z.length);
    }
  });
});

describe("bootstrap", () => {
  it("runs the requested number of iterations", () => {
    const cohort = makeCohort(300, 3);
    const feat = buildFeatures(
      cohort,
      "full",
      "impute",
      ACTIVE.map((m) => m.id)
    );
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
