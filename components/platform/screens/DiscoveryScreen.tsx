import type { ToggleOpt } from "@/lib/types";
import { Info } from "../InfoTip";
import { MetricLineChart, type MetricLineChartData } from "../charts/MetricLineChart";
import { HBarList, type HBarRow } from "../charts/HBarList";

interface AlgoOpt extends ToggleOpt {
  dis: boolean;
  op: number;
}

export interface DiscoveryVals {
  featureSetOpts: ToggleOpt[];
  featCount: string;
  algoOpts: AlgoOpt[];
  algoNote: string;
  missingOpts: ToggleOpt[];
  missingNote: string;
  k: number;
  setK: (e: React.ChangeEvent<HTMLInputElement>) => void;
  seed: number;
  setSeed: (e: React.ChangeEvent<HTMLInputElement>) => void;
  busyNote: string;
  metricCharts: MetricLineChartData[];
  sizeBars: HBarRow[];
  sizeNote: string;
  featChips: { name: string }[];
  onAddSolution: () => void;
  onExportFeatures: () => void;
}

export function DiscoveryScreen({ V }: { V: DiscoveryVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>
        Phenotype discovery
        <Info id="phenotype" />
      </h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        Choose the feature construction, the algorithm and the range of K. The system reports quality metrics for
        every candidate and declares none of them correct.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 28, alignItems: "start" }}>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Feature construction
            <Info id="feature" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {V.featureSetOpts.map((o) => (
              <label key={o.label} className="radio">
                <input type="radio" name="featureset" checked={o.on} onChange={o.go} />
                <span className="dot" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="text-muted mono" style={{ fontSize: 11, marginTop: 8 }}>
            {V.featCount}
          </div>
        </div>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Clustering algorithm
            <Info id="algorithm" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {V.algoOpts.map((o) => (
              <label key={o.label} className="radio" style={{ opacity: o.op }}>
                <input type="radio" name="algo" checked={o.on} disabled={o.dis} onChange={o.go} />
                <span className="dot" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="text-muted mono" style={{ fontSize: 11, marginTop: 8 }}>
            {V.algoNote}
          </div>
        </div>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Missing-data strategy
            <Info id="imputation" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {V.missingOpts.map((o) => (
              <label key={o.label} className="radio">
                <input type="radio" name="missing" checked={o.on} onChange={o.go} />
                <span className="dot" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="text-muted mono" style={{ fontSize: 11, marginTop: 8 }}>
            {V.missingNote}
          </div>
        </div>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Number of clusters — K = {V.k}
            <Info id="k" />
          </div>
          <input type="range" min={2} max={8} step={1} value={V.k} onChange={V.setK} />
          <div className="lbl mono" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>2</span>
            <span>8</span>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>
              Random seed
              <Info id="seed" />
            </label>
            <input className="input mono" type="number" value={V.seed} onChange={V.setSeed} />
          </div>
          <div className="text-muted mono" style={{ fontSize: 11, marginTop: 6 }}>
            {V.busyNote}
          </div>
        </div>
      </div>

      <hr className="hr" />
      <h6>
        Cluster quality across the K range
        <Info id="cluster_quality" />
      </h6>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)", marginTop: 8 }}>
        {V.metricCharts.map((ch, i) => (
          <MetricLineChart key={i} ch={ch} />
        ))}
      </div>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <h6>
            Cluster sizes at K = {V.k}
            <Info id="cluster_size" />
          </h6>
          <HBarList rows={V.sizeBars} valueWidth={74} />
          <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
            {V.sizeNote}
          </p>
        </section>
        <section>
          <h6>
            Variables entering this run
            <Info id="feature" />
          </h6>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {V.featChips.map((f, i) => (
              <span key={i} className="tag tag-neutral mono">
                {f.name}
              </span>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
            Derived features are kept separate from the raw clinical variables they came from; both are exportable.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="btn btn-primary" type="button" onClick={V.onAddSolution}>
              Add this solution to comparison
            </button>
            <button className="btn btn-secondary" type="button" onClick={V.onExportFeatures}>
              Export feature dataset (CSV)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
