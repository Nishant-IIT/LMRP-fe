import { Info } from "./InfoTip";

export interface RecordRow {
  k: string;
  v: string;
}

export interface ExportItem {
  name: string;
  fmt: string;
  go: () => void;
  dis?: boolean;
}

export interface AnalysisRecordVals {
  record: RecordRow[];
  exports: ExportItem[];
  onClose: () => void;
}

// Right-side drawer: the full reproducibility record for the current run,
// plus every CSV/figure export. Can be opened from any screen.
export function AnalysisRecordDrawer({ V }: { V: AnalysisRecordVals }) {
  return (
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 2 }}>
              Analysis record
              <Info id="analysis_record" />
            </h3>
            <div className="lbl">Written on every run · required to reproduce</div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={V.onClose}>
            Close
          </button>
        </div>
        <hr className="hr" />
        <table className="table">
          <tbody>
            {V.record.map((r, i) => (
              <tr key={i}>
                <td className="lbl" style={{ width: "42%" }}>
                  {r.k}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {r.v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="hr" />
        <h6>Exports</h6>
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          {V.exports.map((e, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-block"
              type="button"
              onClick={e.go}
              disabled={e.dis}
              style={{ justifyContent: "space-between", marginTop: 0 }}
            >
              <span>{e.name}</span>
              <span className="lbl">{e.fmt}</span>
            </button>
          ))}
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 14 }}>
          Re-running with the recorded seed and parameters reproduces the partition exactly. The record travels with
          every export.
        </p>
      </div>
    </div>
  );
}
