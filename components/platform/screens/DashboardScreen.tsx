import { Info } from "../InfoTip";
import { Heatmap } from "../charts/Heatmap";

export interface DashboardVals {
  tpCards: { label: string; n: number; pct: number; pctLabel: string }[];
  quality: { completeBaseline: number; incompleteBaseline: number; pMissLabel: string };
  flags: { sid: string; tp: string; kind: string; detail: string }[];
  missGrid: {
    vb: string;
    cols: { label: string; x: number; y: number }[];
    rows: { label: string; y: number }[];
    cells: { x: number; y: number; w: number; h: number; op: number; tx: number; ty: number; txt: string; ink: string }[];
  };
  status: {
    algoName: string;
    featureLine: string;
    smallest: string;
    sil: string;
    db: string;
    stability: string;
    stabilityNote: string;
    clfAcc: string;
    clfNote: string;
    provisional: string;
    provisionalNote: string;
  };
  k: number;
  onExportQuality: () => void;
}

export function DashboardScreen({ V }: { V: DashboardVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Study status</h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        Recruitment, data quality and analysis state for the current dataset version. Nothing on this screen is a finding.
      </p>

      <hr className="hr" />
      <h6>Recruitment and follow-up</h6>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)" }}>
        {V.tpCards.map((t, i) => (
          <div key={i} style={{ background: "var(--color-bg)", padding: 12 }}>
            <div className="lbl">{t.label}</div>
            <div className="num" style={{ fontSize: 34, margin: "8px 0 6px" }}>
              {t.n}
            </div>
            <div style={{ height: 4, background: "var(--color-neutral-300)" }}>
              <div style={{ height: 4, background: "var(--color-accent)", width: `${t.pct}%` }} />
            </div>
            <div className="lbl mono" style={{ marginTop: 5 }}>
              {t.pctLabel} of enrolled
            </div>
          </div>
        ))}
      </div>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 32 }}>
        <section>
          <h6>
            Data quality — missingness by measure and timepoint
            <Info id="missingness" />
          </h6>
          <Heatmap viewBox={V.missGrid.vb} cols={V.missGrid.cols} rows={V.missGrid.rows} cells={V.missGrid.cells} ariaLabel="Missingness heatmap" />
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            Percentage of enrolled participants with no usable value. A missed assessment is represented as missing,
            never carried forward.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" onClick={V.onExportQuality}>
              Export quality report (CSV)
            </button>
          </div>
        </section>

        <section>
          <h6>
            Flagged records
            <Info id="flags" />
          </h6>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Study ID</th>
                <th>Point</th>
                <th>Check</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {V.flags.map((f, i) => (
                <tr key={i}>
                  <td className="mono">{f.sid}</td>
                  <td className="mono">{f.tp}</td>
                  <td>{f.kind}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {f.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              background: "var(--color-divider)",
              marginTop: 20,
            }}
          >
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">
                Complete baseline
                <Info id="baseline_complete" />
              </div>
              <div className="num" style={{ fontSize: 26, marginTop: 6 }}>
                {V.quality.completeBaseline}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">Incomplete baseline</div>
              <div className="num" style={{ fontSize: 26, marginTop: 6 }}>
                {V.quality.incompleteBaseline}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">
                Mean per-participant missingness
                <Info id="participant_missing" />
              </div>
              <div className="num" style={{ fontSize: 26, marginTop: 6 }}>
                {V.quality.pMissLabel}
              </div>
            </div>
          </div>
        </section>
      </div>

      <hr className="hr" />
      <h6>Analysis status</h6>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(50%, 240px), 1fr))",
          gap: 2,
          background: "var(--color-divider)",
          marginTop: 8,
        }}
      >
        <div style={{ background: "var(--color-bg)", padding: 14 }}>
          <div className="lbl">
            Latest phenotype run
            <Info id="phenotype_run" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            {V.status.algoName}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            {V.status.featureLine}
          </div>
        </div>
        <div style={{ background: "var(--color-bg)", padding: 14 }}>
          <div className="lbl">
            Clusters in view
            <Info id="k" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            K = {V.k}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            smallest {V.status.smallest}
          </div>
        </div>
        <div style={{ background: "var(--color-bg)", padding: 14 }}>
          <div className="lbl">
            Silhouette
            <Info id="silhouette" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            {V.status.sil}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            Davies–Bouldin {V.status.db}
          </div>
        </div>
        <div style={{ background: "var(--color-bg)", padding: 14 }}>
          <div className="lbl">
            Bootstrap stability
            <Info id="bootstrap" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            {V.status.stability}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            {V.status.stabilityNote}
          </div>
        </div>
        <div style={{ background: "var(--color-bg)", padding: 14 }}>
          <div className="lbl">
            Early classifier
            <Info id="classifier" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            {V.status.clfAcc}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            {V.status.clfNote}
          </div>
        </div>
        <div style={{ background: "var(--color-bg)", padding: 14, borderLeft: "2px solid var(--color-accent)" }}>
          <div className="lbl" style={{ color: "var(--color-accent-700)" }}>
            Provisional solution
            <Info id="provisional" />
          </div>
          <div className="num" style={{ fontSize: 22, margin: "8px 0 4px" }}>
            {V.status.provisional}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            {V.status.provisionalNote}
          </div>
        </div>
      </div>
    </div>
  );
}
