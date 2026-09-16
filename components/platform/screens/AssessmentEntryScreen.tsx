import type { ToggleOpt as Opt } from "@/lib/types";
import { Info } from "../InfoTip";

export interface EntryVals {
  sid: string;
  tpLabel: string;
  nprs: number;
  sts: string;
  fabqScore: number;
  odiRaw: number;
  odiMax: number;
  odiPct: string;
  odiMissing: number;
  status: string;
  statusNote: string;
  statusBg: string;
  statusInk: string;
  odiItems: { text: string; opts: Opt[] }[];
  fabqItems: { text: string; opts: Opt[] }[];
  payload: string;
  setNprs: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSts: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

function ItemRows({ items }: { items: { text: string; opts: Opt[] }[] }) {
  return (
    <>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            alignItems: "center",
            padding: "5px 0",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <span style={{ fontSize: 13 }}>{it.text}</span>
          <span style={{ display: "flex", gap: 2 }}>
            {it.opts.map((o, j) => (
              <button key={j} className="cellbtn mono" type="button" aria-pressed={o.on} onClick={o.go}>
                {o.label}
              </button>
            ))}
          </span>
        </div>
      ))}
    </>
  );
}

export function AssessmentEntryScreen({ V }: { V: EntryVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Assessment entry</h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        Item-level responses are stored and retained. Scores are derived from the items at read time, never entered
        directly.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div className="field">
              <label>Study ID</label>
              <input className="input mono" type="text" value={V.sid} readOnly />
            </div>
            <div className="field">
              <label>Timepoint</label>
              <input className="input mono" type="text" value={V.tpLabel} readOnly />
            </div>
            <div className="field">
              <label>Assessment date</label>
              <input className="input mono" type="text" value="2026-09-13" readOnly />
            </div>
            <div className="field">
              <label>Assessor ID</label>
              <input className="input mono" type="text" value="ASR-02" readOnly />
            </div>
          </div>

          <hr className="hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h6 style={{ margin: 0 }}>
              Pain — NPRS
              <Info id="nprs" />
            </h6>
            <span className="num mono" style={{ fontSize: 22 }}>
              {V.nprs}
              <span className="text-muted" style={{ fontSize: 13 }}>
                /10
              </span>
            </span>
          </div>
          <input type="range" min={0} max={10} step={1} value={V.nprs} onChange={V.setNprs} style={{ marginTop: 10 }} />
          <div className="lbl mono" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>0 no pain</span>
            <span>10 worst imaginable</span>
          </div>

          <hr className="hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h6 style={{ margin: 0 }}>
              Function — 5× sit-to-stand
              <Info id="sts" />
            </h6>
            <span className="num mono" style={{ fontSize: 22 }}>
              {V.sts}
              <span className="text-muted" style={{ fontSize: 13 }}>
                s
              </span>
            </span>
          </div>
          <input type="range" min={4} max={40} step={0.5} value={V.sts} onChange={V.setSts} style={{ marginTop: 10 }} />

          <hr className="hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h6 style={{ margin: 0 }}>
              Psychosocial — FABQ-PA
              <Info id="fabq" />
            </h6>
            <span className="num mono" style={{ fontSize: 22 }}>
              {V.fabqScore}
              <span className="text-muted" style={{ fontSize: 13 }}>
                /24
              </span>
            </span>
          </div>
          <ItemRows items={V.fabqItems} />
        </section>

        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h6 style={{ margin: 0 }}>
              Disability — ODI, 10 sections
              <Info id="odi" />
            </h6>
            <span className="lbl">0 none … 5 most severe · — not answered</span>
          </div>
          <ItemRows items={V.odiItems} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)", marginTop: 20 }}>
            <div style={{ background: "var(--color-surface)", padding: 12 }}>
              <div className="lbl">
                Raw score
                <Info id="raw_score" />
              </div>
              <div className="num mono" style={{ fontSize: 28, marginTop: 6 }}>
                {V.odiRaw}
              </div>
              <div className="lbl mono">of {V.odiMax} possible</div>
            </div>
            <div style={{ background: "var(--color-surface)", padding: 12 }}>
              <div className="lbl">
                Normalised
                <Info id="normalised" />
              </div>
              <div className="num mono" style={{ fontSize: 28, marginTop: 6 }}>
                {V.odiPct}
              </div>
              <div className="lbl mono">index, 0–100</div>
            </div>
            <div style={{ background: "var(--color-surface)", padding: 12 }}>
              <div className="lbl">
                Missing items
                <Info id="item_missing" />
              </div>
              <div className="num mono" style={{ fontSize: 28, marginTop: 6 }}>
                {V.odiMissing}
              </div>
              <div className="lbl mono">of 10 sections</div>
            </div>
            <div style={{ background: V.statusBg, padding: 12 }}>
              <div className="lbl" style={{ color: V.statusInk }}>
                Status
              </div>
              <div className="num" style={{ fontSize: 20, marginTop: 8, color: V.statusInk }}>
                {V.status}
              </div>
              <div className="lbl mono" style={{ color: V.statusInk }}>
                {V.statusNote}
              </div>
            </div>
          </div>

          <div style={{ border: "2px solid var(--color-divider)", padding: 14, marginTop: 20 }}>
            <div className="lbl">
              What is written to the database
              <Info id="item_level" />
            </div>
            <pre className="mono" style={{ fontSize: 11, margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {V.payload}
            </pre>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="button" disabled>
              Save assessment
            </button>
            <button className="btn btn-secondary" type="button" onClick={V.onReset}>
              Reset form
            </button>
            <span className="text-muted" style={{ fontSize: 12, alignSelf: "center" }}>
              Saving is disabled in the sample.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
