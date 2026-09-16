import type { ToggleOpt as Opt } from "@/lib/types";
import { Info } from "../InfoTip";

export interface EnrolVals {
  sid: string;
  date: string;
  age: number;
  height: number;
  weight: number;
  duration: number;
  episodes: number;
  bmi: string;
  durationLabel: string;
  durationClass: string;
  consent: boolean;
  setAge: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setHeight: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setWeight: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setDuration: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setEpisodes: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleConsent: () => void;
  sexOpts: Opt[];
  loadOpts: Opt[];
  siteOpts: Opt[];
  inclusion: { text: string; opts: Opt[] }[];
  exclusion: { text: string; opts: Opt[] }[];
  status: string;
  statusNote: string;
  statusBg: string;
  statusInk: string;
  blocked: boolean;
  actionNote: string;
  schedule: { id: string; label: string; date: string; window: string; status: string }[];
  payload: string;
  onEnrol: () => void;
  onReset: () => void;
}

function Segmented({ name, opts }: { name: string; opts: Opt[] }) {
  return (
    <div className="seg">
      {opts.map((o) => (
        <label key={o.label} className="seg-opt mono" style={{ fontSize: 12 }}>
          <input type="radio" name={name} checked={o.on} onChange={o.go} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function CriteriaList({ items }: { items: { text: string; opts: Opt[] }[] }) {
  return (
    <>
      {items.map((c, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <span style={{ fontSize: 13 }}>{c.text}</span>
          <span style={{ display: "flex", gap: 2 }}>
            {c.opts.map((o) => (
              <button key={o.label} className="cellbtn mono" type="button" aria-pressed={o.on} onClick={o.go} style={{ minWidth: 44 }}>
                {o.label}
              </button>
            ))}
          </span>
        </div>
      ))}
    </>
  );
}

export function EnrolmentScreen({ V }: { V: EnrolVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Enrolment</h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        The entry point. A participant gets a study ID, an eligibility record and a baseline visit schedule here —
        before any outcome measure is collected.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div className="field">
              <label>
                Study ID — assigned
                <Info id="study_id" />
              </label>
              <input className="input mono" type="text" value={V.sid} readOnly />
            </div>
            <div className="field">
              <label>Enrolment date</label>
              <input className="input mono" type="text" value={V.date} readOnly />
            </div>
            <div className="field">
              <label>
                Site
                <Info id="site" />
              </label>
              <Segmented name="enrolsite" opts={V.siteOpts} />
            </div>
          </div>

          <hr className="hr" />
          <h6 style={{ margin: 0 }}>
            Eligibility
            <Info id="eligibility" />
          </h6>
          <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>
            Recorded per participant, not just checked once. A failed criterion blocks enrolment and is kept as a
            screening record.
          </p>
          <div className="lbl" style={{ marginBottom: 6 }}>
            Inclusion — all must be confirmed
          </div>
          <CriteriaList items={V.inclusion} />
          <div className="lbl" style={{ margin: "16px 0 6px" }}>
            Exclusion — none may be present
          </div>
          <CriteriaList items={V.exclusion} />

          <hr className="hr" />
          <h6 style={{ margin: "0 0 10px" }}>Baseline characteristics</h6>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            <div className="field">
              <label>Age — years</label>
              <input className="input mono" type="number" min={16} max={95} value={V.age} onChange={V.setAge} />
            </div>
            <div className="field">
              <label>Height — cm</label>
              <input className="input mono" type="number" min={130} max={215} value={V.height} onChange={V.setHeight} />
            </div>
            <div className="field">
              <label>Weight — kg</label>
              <input className="input mono" type="number" min={35} max={200} value={V.weight} onChange={V.setWeight} />
            </div>
            <div className="field">
              <label>Symptom duration — weeks</label>
              <input className="input mono" type="number" min={1} max={520} value={V.duration} onChange={V.setDuration} />
            </div>
            <div className="field">
              <label>Prior episodes</label>
              <input className="input mono" type="number" min={0} max={20} value={V.episodes} onChange={V.setEpisodes} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
            <div className="field">
              <label>Sex</label>
              <Segmented name="enrolsex" opts={V.sexOpts} />
            </div>
            <div className="field">
              <label>
                Occupational loading
                <Info id="load" />
              </label>
              <Segmented name="enrolload" opts={V.loadOpts} />
            </div>
          </div>
        </section>

        <section>
          <h6 style={{ margin: "0 0 10px" }}>
            Consent
            <Info id="consent" />
          </h6>
          <div style={{ border: "2px solid var(--color-divider)", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div className="mono" style={{ fontSize: 13 }}>
                Participant information sheet v2.1
              </div>
              <span className="lbl mono">dated 2026-04-02</span>
            </div>
            <label className="radio" style={{ marginTop: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={V.consent} onChange={V.toggleConsent} />
              <span className="dot" />
              Informed consent taken and recorded
            </label>
            <p className="text-muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
              The consent version is stored with the participant, so a re-consent can be distinguished from the
              original.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)", marginTop: 20 }}>
            <div style={{ background: "var(--color-surface)", padding: 12 }}>
              <div className="lbl">
                BMI
                <Info id="bmi_derived" />
              </div>
              <div className="num mono" style={{ fontSize: 28, marginTop: 6 }}>
                {V.bmi}
              </div>
              <div className="lbl mono">derived, not entered</div>
            </div>
            <div style={{ background: "var(--color-surface)", padding: 12 }}>
              <div className="lbl">
                Symptom duration
                <Info id="symptom_duration" />
              </div>
              <div className="num mono" style={{ fontSize: 28, marginTop: 6 }}>
                {V.durationLabel}
              </div>
              <div className="lbl mono">{V.durationClass}</div>
            </div>
            <div style={{ background: V.statusBg, padding: 12 }}>
              <div className="lbl" style={{ color: V.statusInk }}>
                Eligibility
              </div>
              <div className="num" style={{ fontSize: 20, marginTop: 8, color: V.statusInk }}>
                {V.status}
              </div>
              <div className="lbl mono" style={{ color: V.statusInk }}>
                {V.statusNote}
              </div>
            </div>
          </div>

          <h6 style={{ margin: "22px 0 0" }}>
            Visit schedule generated on enrolment
            <Info id="schedule" />
          </h6>
          <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Target dates come from the enrolment date and the configured timepoint windows. Nothing is pre-filled as
            a value.
          </p>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Point</th>
                <th>Visit</th>
                <th>Target date</th>
                <th>Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {V.schedule.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{r.label}</td>
                  <td className="mono">{r.date}</td>
                  <td className="mono">{r.window}</td>
                  <td className="mono text-muted">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ border: "2px solid var(--color-divider)", padding: 14, marginTop: 20 }}>
            <div className="lbl">What is written to the database</div>
            <pre className="mono" style={{ fontSize: 11, margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {V.payload}
            </pre>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-primary" type="button" disabled={V.blocked} onClick={V.onEnrol}>
              Enrol and open baseline visit
            </button>
            <button className="btn btn-secondary" type="button" onClick={V.onReset}>
              Reset form
            </button>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {V.actionNote}
            </span>
          </div>

          <div style={{ borderLeft: "2px solid var(--color-accent)", padding: "12px 14px", marginTop: 20, background: "var(--color-accent-100)" }}>
            <div className="lbl" style={{ color: "var(--color-accent-700)" }}>
              What happens next
            </div>
            <p style={{ fontSize: 13, margin: "6px 0 0" }}>
              The baseline assessment is collected on the Assessment screen. This participant has no phenotype until
              the cohort analysis is re-run — clustering is a cohort operation. Once a provisional solution exists,
              their cluster can be predicted from baseline and week 2 alone on the Classification screen.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
