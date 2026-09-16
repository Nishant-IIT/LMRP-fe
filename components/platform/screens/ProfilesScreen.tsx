import { Info } from "../InfoTip";
import { ClusterTrajectoryChart, type ClusterTrajectoryData } from "../charts/ClusterTrajectoryChart";
import { HBarList, type HBarRow } from "../charts/HBarList";

export interface ClusterCard {
  label: string;
  color: string;
  n: number;
  pct: string;
  age: string;
  female: string;
  bmi: string;
  duration: string;
  domains: { domain: string; shape: string; delta: string }[];
  chart: ClusterTrajectoryData;
  note: string;
  setNote: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stability: string;
}

export interface BootVals {
  meanARI: string;
  interval: string;
  iters: number | string;
  bars: HBarRow[];
  note: string;
}

export interface ProfilesVals {
  clusters: ClusterCard[];
  bootIters: number;
  setBootIters: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bootLabel: string;
  onRunBoot: () => void;
  boot: BootVals;
  truthCols: { label: string }[];
  truthRows: { label: string; cells: { txt: string; bg: string }[] }[];
  truthARI: string;
}

export function ProfilesScreen({ V }: { V: ProfilesVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>
        Cluster profiles
        <Info id="cluster" />
      </h1>
      <p className="text-muted" style={{ maxWidth: "70ch", fontSize: 14 }}>
        Neutral labels only. Descriptions below are arithmetic summaries of the trajectories; any clinical name is
        typed by the researcher and stored as an interpretation, attributed and dated.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
        {V.clusters.map((c, i) => (
          <section key={i} style={{ background: "var(--color-bg)", padding: 16, border: "1px solid var(--color-divider)", borderTop: `4px solid ${c.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h4 style={{ margin: 0 }}>{c.label}</h4>
              <span className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                n = {c.n} · {c.pct}
              </span>
            </div>
            <div className="lbl mono" style={{ marginTop: 4 }}>
              age {c.age} · {c.female} female · BMI {c.bmi} · duration {c.duration}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {c.domains.map((d, j) => (
                <div key={j} style={{ display: "grid", gridTemplateColumns: "94px minmax(0, 1fr)", gap: 10, alignItems: "baseline" }}>
                  <span className="lbl">{d.domain}</span>
                  <span style={{ fontSize: 13 }}>
                    {d.shape}
                    <span className="text-muted mono"> · {d.delta}</span>
                  </span>
                </div>
              ))}
            </div>
            <ClusterTrajectoryChart c={c.chart} />
            <figcaption>Proportion of each measure&rsquo;s baseline value remaining, cluster mean. Lower is more recovered.</figcaption>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Researcher interpretation — optional, not used by any model</label>
              <input className="input" type="text" placeholder="e.g. candidate label, pending review" value={c.note} onChange={c.setNote} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px solid var(--color-divider)",
              }}
            >
              <span className="lbl">
                Bootstrap stability
                <Info id="cluster_stability" />
              </span>
              <span className="mono" style={{ fontSize: 13 }}>
                {c.stability}
              </span>
            </div>
          </section>
        ))}
      </div>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h6 style={{ margin: 0 }}>
                Bootstrap resampling
                <Info id="bootstrap" />
              </h6>
              <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Resample with replacement, re-cluster, compare to the original partition, repeat.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div className="field" style={{ width: 96 }}>
                <label>Iterations</label>
                <input className="input mono" type="number" min={10} max={200} step={5} value={V.bootIters} onChange={V.setBootIters} />
              </div>
              <button className="btn btn-primary" type="button" onClick={V.onRunBoot}>
                {V.bootLabel}
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)", marginTop: 14 }}>
            <div style={{ background: "var(--color-bg)", padding: 12 }}>
              <div className="lbl">
                Mean adjusted Rand
                <Info id="ari" />
              </div>
              <div className="num mono" style={{ fontSize: 26, marginTop: 6 }}>
                {V.boot.meanARI}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 12 }}>
              <div className="lbl">
                95% interval
                <Info id="ci" />
              </div>
              <div className="num mono" style={{ fontSize: 26, marginTop: 6 }}>
                {V.boot.interval}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 12 }}>
              <div className="lbl">
                Iterations run
                <Info id="iterations" />
              </div>
              <div className="num mono" style={{ fontSize: 26, marginTop: 6 }}>
                {V.boot.iters}
              </div>
            </div>
          </div>
          <HBarList rows={V.boot.bars} valueWidth={58} />
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            {V.boot.note}
          </p>
        </section>

        <section>
          <h6>
            Recovery of the known synthetic patterns
            <Info id="ground_truth" />
          </h6>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Available only in synthetic mode. With real participants there is no ground truth and this panel is
            absent.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Generated pattern</th>
                  {V.truthCols.map((c, i) => (
                    <th key={i} className="mono">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {V.truthRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13 }}>{r.label}</td>
                    {r.cells.map((c, j) => (
                      <td key={j} className="mono" style={{ background: c.bg }}>
                        {c.txt}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="lbl">
              Adjusted Rand vs generator
              <Info id="ari" />
            </div>
            <div className="num mono" style={{ fontSize: 26, marginTop: 4 }}>
              {V.truthARI}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
