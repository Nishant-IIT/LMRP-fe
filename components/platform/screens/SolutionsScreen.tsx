import { Info } from "../InfoTip";

export interface SolutionRow {
  id: string;
  time: string;
  k: number;
  algo: string;
  seed: number;
  featureSet: string;
  nFeat: number;
  measures: string;
  missing: string;
  n: number;
  smallest: string;
  sil: string;
  ch: string;
  db: string;
  stab: string;
  bg: string;
  markLabel: string;
  mark: () => void;
}

export interface SensRow {
  label: string;
  value: string;
  pct: number;
}

export interface CrossCell {
  txt: string;
  bg: string;
}

export interface SolutionsVals {
  solutionRows: SolutionRow[];
  solutionsNote: string;
  sensLabel: string;
  onRunSensitivity: () => void;
  sensRows: SensRow[];
  k: number;
  crossCols: { label: string }[];
  crossRows: { label: string; n: number; cells: CrossCell[] }[];
  cross: { kappa: string; ari: string; v: string; note: string };
}

export function SolutionsScreen({ V }: { V: SolutionsVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Candidate solution comparison</h1>
      <p className="text-muted" style={{ maxWidth: "70ch", fontSize: 14 }}>
        Every run you keep is listed here with the choices that produced it. The researcher marks one solution
        provisional; the software does not, and a statistically preferred solution is not a validated phenotype.
      </p>
      <hr className="hr" />

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Run</th>
              <th>K</th>
              <th>Algorithm</th>
              <th>Variables</th>
              <th>Missing data</th>
              <th>Smallest cluster</th>
              <th>
                Silhouette
                <Info id="silhouette" />
              </th>
              <th>
                Calinski–H.
                <Info id="ch" />
              </th>
              <th>
                Davies–B.
                <Info id="db" />
              </th>
              <th>
                Stability
                <Info id="bootstrap" />
              </th>
              <th>Provisional</th>
            </tr>
          </thead>
          <tbody>
            {V.solutionRows.map((s) => (
              <tr key={s.id} style={{ background: s.bg }}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {s.id}
                  <div className="text-muted">{s.time}</div>
                </td>
                <td className="mono">{s.k}</td>
                <td>
                  {s.algo}
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    seed {s.seed}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  {s.featureSet}
                  <div className="text-muted mono">
                    {s.nFeat} features · {s.measures}
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {s.missing}
                  <div className="text-muted">n = {s.n}</div>
                </td>
                <td className="mono">{s.smallest}</td>
                <td className="mono">{s.sil}</td>
                <td className="mono">{s.ch}</td>
                <td className="mono">{s.db}</td>
                <td className="mono">{s.stab}</td>
                <td>
                  <button className="btn btn-secondary mono" type="button" onClick={s.mark} style={{ fontSize: 12 }}>
                    {s.markLabel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
        {V.solutionsNote}
      </p>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <h6>
            Sensitivity — does the structure survive the choices?
            <Info id="sensitivity" />
          </h6>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Adjusted Rand index between the solution in view and the same K under each alternative setting. 1.00 is
            identical partitioning.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {V.sensRows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 120px) 52px",
                  gap: 10,
                  alignItems: "center",
                  borderBottom: "1px solid var(--color-divider)",
                  paddingBottom: 5,
                }}
              >
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span style={{ height: 12, background: "var(--color-neutral-300)", display: "block" }}>
                  <span style={{ display: "block", height: 12, background: "var(--color-accent)", width: `${r.pct}%` }} />
                </span>
                <span className="mono" style={{ fontSize: 13, textAlign: "right" }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" type="button" onClick={V.onRunSensitivity} style={{ marginTop: 14 }}>
            {V.sensLabel}
          </button>
        </section>
        <section>
          <h6>
            Against the conventional classification
            <Info id="conventional" />
          </h6>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Cross-tabulation of the uploaded conventional risk group against the data-derived clusters at K = {V.k}.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Conventional</th>
                  {V.crossCols.map((c, i) => (
                    <th key={i} className="mono">
                      {c.label}
                    </th>
                  ))}
                  <th className="mono">n</th>
                </tr>
              </thead>
              <tbody>
                {V.crossRows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.label}</td>
                    {r.cells.map((c, j) => (
                      <td key={j} className="mono" style={{ background: c.bg }}>
                        {c.txt}
                      </td>
                    ))}
                    <td className="mono">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
            <div>
              <div className="lbl">
                Cohen&rsquo;s κ
                <Info id="kappa" />
              </div>
              <div className="num mono" style={{ fontSize: 22, marginTop: 4 }}>
                {V.cross.kappa}
              </div>
            </div>
            <div>
              <div className="lbl">
                Adjusted Rand index
                <Info id="ari" />
              </div>
              <div className="num mono" style={{ fontSize: 22, marginTop: 4 }}>
                {V.cross.ari}
              </div>
            </div>
            <div>
              <div className="lbl">
                Cramér&rsquo;s V
                <Info id="cramer" />
              </div>
              <div className="num mono" style={{ fontSize: 22, marginTop: 4 }}>
                {V.cross.v}
              </div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            {V.cross.note}
          </p>
        </section>
      </div>
    </div>
  );
}
