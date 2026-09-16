import type { ToggleOpt } from "@/lib/types";
import { Info } from "../InfoTip";

interface DirOpt extends ToggleOpt {
  group: string;
}

export interface MeasureRow {
  name: string;
  full: string;
  domain: string;
  range: string;
  items: number;
  dirOpts: DirOpt[];
  lock: boolean;
  stateLabel: string;
  stateNote: string;
  toggle: () => void;
}

export interface AlignCard {
  name: string;
  raw: string;
  transform: string;
}

export interface TpRow {
  id: string;
  label: string;
  week: number;
  window: string;
  n: number;
}

export interface MeasuresVals {
  measureRows: MeasureRow[];
  alignCards: AlignCard[];
  tpRows: TpRow[];
}

export function MeasuresScreen({ V }: { V: MeasuresVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Outcome measure configuration</h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        The investigator adds, retires and re-points measures here. No database migration, and no call site names a
        specific instrument.
      </p>
      <hr className="hr" />

      <table className="table">
        <thead>
          <tr>
            <th>Measure</th>
            <th>Domain</th>
            <th>Range</th>
            <th>Items</th>
            <th>
              Recovery direction
              <Info id="direction" />
            </th>
            <th>In analysis</th>
          </tr>
        </thead>
        <tbody>
          {V.measureRows.map((m) => (
            <tr key={m.name}>
              <td>
                <span className="mono" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
                  {m.name}
                </span>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {m.full}
                </div>
              </td>
              <td>{m.domain}</td>
              <td className="mono">{m.range}</td>
              <td className="mono">{m.items}</td>
              <td>
                <div className="seg">
                  {m.dirOpts.map((d) => (
                    <label key={d.label} className="seg-opt mono" style={{ fontSize: 12 }}>
                      <input type="radio" name={d.group} checked={d.on} onChange={d.go} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </td>
              <td>
                <button className="btn btn-secondary mono" type="button" onClick={m.toggle} disabled={m.lock} style={{ fontSize: 12 }}>
                  {m.stateLabel}
                </button>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {m.stateNote}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 32 }}>
        <section>
          <h6>
            Direction alignment
            <Info id="alignment" />
          </h6>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Before clustering, every variable is transformed to a common recovery direction, so rising disability is
            never treated as equivalent to rising function. Changing a direction above re-runs the pipeline.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)" }}>
            {V.alignCards.map((a) => (
              <div key={a.name} style={{ background: "var(--color-bg)", padding: 10 }}>
                <div className="mono" style={{ fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 800 }}>
                  {a.name}
                </div>
                <div className="lbl" style={{ margin: "4px 0 6px" }}>
                  {a.raw}
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--color-accent-700)" }}>
                  {a.transform}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h6>
            Timepoint schedule
            <Info id="timepoint" />
          </h6>
          <p className="text-muted" style={{ fontSize: 13 }}>
            No participant is assumed to have every timepoint. Windows are configuration, not code.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Point</th>
                <th>Label</th>
                <th>Target week</th>
                <th>
                  Window
                  <Info id="window" />
                </th>
                <th>Assessed</th>
              </tr>
            </thead>
            <tbody>
              {V.tpRows.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td>{t.label}</td>
                  <td className="mono">{t.week}</td>
                  <td className="mono">{t.window}</td>
                  <td className="mono">{t.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
