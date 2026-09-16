import type { ToggleOpt } from "@/lib/types";
import { Info } from "../InfoTip";
import { ConfusionMatrix, type ConfusionMatrixData } from "../charts/ConfusionMatrix";
import { CalibrationCurve, type CalibrationCurveData } from "../charts/CalibrationCurve";

export interface ModelOpt {
  name: string;
  info: string;
  on: boolean;
  acc: string;
  go: () => void;
}

interface ClfOpt extends ToggleOpt {
  dis: boolean;
  op: number;
}

export interface PerClassRow {
  label: string;
  color: string;
  n: number;
  rec: string;
  prec: string;
  spec: string;
  f1: string;
}

export interface HeldOutCase {
  sid: string;
  pred: number;
  conf: string;
}

export interface ClassificationVals {
  modelOpts: ModelOpt[];
  clfOpts: ClfOpt[];
  clfNote: string;
  k: number;
  algoName: string;
  clf: {
    split: string;
    accuracy: string;
    balanced: string;
    macroF1: string;
    perClass: PerClassRow[];
    cases: HeldOutCase[];
  };
  cm: ConfusionMatrixData;
  cal: CalibrationCurveData;
}

export function ClassificationScreen({ V }: { V: ClassificationVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>Early phenotype classification</h1>
      <p className="text-muted" style={{ maxWidth: "70ch", fontSize: 14 }}>
        How early can cluster membership be recovered from data alone? Each model is trained on progressively more
        of the follow-up window, on a participant-level split.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 24, alignItems: "start" }}>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Information available to the model
            <Info id="early_window" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--color-divider)" }}>
            {V.modelOpts.map((m) => (
              <button
                key={m.name}
                className="rowbtn"
                type="button"
                aria-current={m.on}
                onClick={m.go}
                style={{ background: "var(--color-bg)", gridTemplateColumns: "1fr auto", padding: "10px 12px", borderBottom: 0 }}
              >
                <span>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{m.name}</span>
                  <span className="text-muted"> — {m.info}</span>
                </span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {m.acc}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="lbl" style={{ marginBottom: 8 }}>
            Classifier
            <Info id="classifier" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {V.clfOpts.map((o) => (
              <label key={o.label} className="radio" style={{ opacity: o.op }}>
                <input type="radio" name="clf" checked={o.on} disabled={o.dis} onChange={o.go} />
                <span className="dot" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="text-muted mono" style={{ fontSize: 11, marginTop: 8 }}>
            {V.clfNote}
          </div>
          <div className="lbl" style={{ marginTop: 14 }}>
            Target
            <Info id="target" />
          </div>
          <div className="mono" style={{ fontSize: 13 }}>
            Cluster membership at K = {V.k}, {V.algoName}
          </div>
          <div className="lbl" style={{ marginTop: 10 }}>
            Split
            <Info id="split" />
          </div>
          <div className="mono" style={{ fontSize: 13 }}>
            {V.clf.split}
          </div>
        </div>
        <div>
          <div className="lbl" style={{ marginBottom: 8 }}>
            Performance on held-out participants
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, background: "var(--color-divider)" }}>
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">
                Accuracy
                <Info id="accuracy" />
              </div>
              <div className="num mono" style={{ fontSize: 24, marginTop: 4 }}>
                {V.clf.accuracy}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">
                Balanced acc.
                <Info id="balanced" />
              </div>
              <div className="num mono" style={{ fontSize: 24, marginTop: 4 }}>
                {V.clf.balanced}
              </div>
            </div>
            <div style={{ background: "var(--color-bg)", padding: 10 }}>
              <div className="lbl">
                Macro-F1
                <Info id="macro_f1" />
              </div>
              <div className="num mono" style={{ fontSize: 24, marginTop: 4 }}>
                {V.clf.macroF1}
              </div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            Accuracy alone is not the target. Balanced accuracy and per-class recall carry the small clusters.
          </p>
        </div>
      </div>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <h6>
            Confusion matrix
            <Info id="confusion" />
          </h6>
          <ConfusionMatrix cm={V.cm} />
          <figcaption>Rows are the cluster assignment from discovery; columns are the model&rsquo;s prediction.</figcaption>
        </section>

        <section>
          <h6>
            Per-cluster performance
            <Info id="per_class" />
          </h6>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Cluster</th>
                <th>n</th>
                <th>
                  Recall
                  <Info id="recall" />
                </th>
                <th>
                  Precision
                  <Info id="precision" />
                </th>
                <th>
                  Specificity
                  <Info id="specificity" />
                </th>
                <th>
                  F1
                  <Info id="f1" />
                </th>
              </tr>
            </thead>
            <tbody>
              {V.clf.perClass.map((p, i) => (
                <tr key={i}>
                  <td className="mono">
                    <span style={{ display: "inline-block", width: 9, height: 9, background: p.color, marginRight: 6 }} />
                    {p.label}
                  </td>
                  <td className="mono">{p.n}</td>
                  <td className="mono">{p.rec}</td>
                  <td className="mono">{p.prec}</td>
                  <td className="mono">{p.spec}</td>
                  <td className="mono">{p.f1}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h6 style={{ marginTop: 24 }}>
            Calibration
            <Info id="calibration" />
          </h6>
          <CalibrationCurve cal={V.cal} />
          <figcaption>Observed accuracy against predicted confidence, five bins. The dashed line is perfect calibration.</figcaption>
        </section>
      </div>

      <hr className="hr" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 32, alignItems: "start" }}>
        <section>
          <h6>
            Held-out predictions
            <Info id="held_out" />
          </h6>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Study ID</th>
                <th>Predicted</th>
                <th>
                  Model confidence
                  <Info id="confidence" />
                </th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {V.clf.cases.map((c, i) => (
                <tr key={i}>
                  <td className="mono">{c.sid}</td>
                  <td className="mono">Cluster {c.pred}</td>
                  <td className="mono">{c.conf}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    no recommendation issued
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section style={{ border: "2px solid var(--color-accent)", padding: 16 }}>
          <div className="lbl" style={{ color: "var(--color-accent-700)" }}>
            Scope of the output
          </div>
          <p style={{ fontSize: 14, margin: "8px 0 0" }}>
            The platform reports a predicted cluster and a confidence value. It does not rank treatments, suggest a
            pathway, or assert that a cluster is clinically meaningful. Interpretation and any clinical decision stay
            with the researcher or clinician.
          </p>
        </section>
      </div>
    </div>
  );
}
