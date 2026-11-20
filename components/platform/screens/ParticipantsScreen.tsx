import type { ToggleOpt } from "@/lib/types";
import { Info } from "../InfoTip";
import { TrajectoryPanel, type TrajectoryPanelData } from "../charts/TrajectoryPanel";
import { PopulationChart, type PopulationChartData } from "../charts/PopulationChart";

export interface RosterRow {
  sid: string;
  sel: boolean;
  go: () => void;
  color: string;
  dots: { fill: string }[];
}

export interface ParticipantsVals {
  listNote: string;
  roster: RosterRow[];
  query: string;
  setQuery: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sel: { sid: string; meta: string; riskTag: string; clusterLabel: string };
  onEdit: () => void;
  editDisabled: boolean;
  panels: TrajectoryPanelData[];
  popDomains: ToggleOpt[];
  popViews: ToggleOpt[];
  pop: PopulationChartData;
}

export function ParticipantsScreen({ V }: { V: ParticipantsVals }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, marginBottom: 4 }}>
        Participants and trajectories
        <Info id="trajectory" />
      </h1>
      <p className="text-muted" style={{ maxWidth: "62ch", fontSize: 14 }}>
        Individual longitudinal trajectories alongside the population distribution. Averages are shown next to
        individuals, never instead of them.
      </p>
      <hr className="hr" />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <h6 style={{ margin: 0 }}>Cohort</h6>
            <span className="lbl mono">{V.listNote}</span>
          </div>
          <input className="input" type="text" placeholder="Filter by study ID" value={V.query} onChange={V.setQuery} style={{ margin: "8px 0" }} />
          <div style={{ maxHeight: 620, overflow: "auto", borderTop: "2px solid var(--color-divider)" }}>
            {V.roster.map((p) => (
              <button
                key={p.sid}
                className="rowbtn mono"
                type="button"
                aria-current={p.sel}
                onClick={p.go}
                style={{ gridTemplateColumns: "1fr auto auto", gap: 8 }}
              >
                <span>{p.sid}</span>
                <span style={{ display: "flex", gap: 2 }}>
                  {p.dots.map((d, i) => (
                    <span key={i} style={{ width: 7, height: 12, display: "block", background: d.fill }} />
                  ))}
                </span>
                <span style={{ width: 9, height: 9, display: "block", background: p.color }} />
              </button>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Bars are the six timepoints — solid where assessed, hollow where missing. The square is the
            participant&rsquo;s cluster under the current solution.
          </p>
        </section>

        <section>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h3 className="mono" style={{ marginBottom: 2 }}>
                {V.sel.sid}
              </h3>
              <div className="text-muted mono" style={{ fontSize: 13 }}>
                {V.sel.meta}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="tag tag-neutral mono">
                {V.sel.riskTag}
                <Info id="conventional" />
              </span>
              <span className="tag tag-outline mono">{V.sel.clusterLabel}</span>
              <button className="btn btn-secondary" type="button" disabled={V.editDisabled} onClick={V.onEdit}>
                Edit enrolment
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
              gap: 2,
              background: "var(--color-divider)",
              marginTop: 16,
            }}
          >
            {V.panels.map((p, i) => (
              <TrajectoryPanel key={i} p={p} />
            ))}
          </div>

          <hr className="hr" />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h6 style={{ margin: 0 }}>
                Population-level view
                <Info id="population_view" />
              </h6>
              <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Individual heterogeneity is the research question, so individual lines stay available at every
                setting.
              </p>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div className="seg">
                {V.popDomains.map((d) => (
                  <label key={d.label} className="seg-opt mono">
                    <input type="radio" name="popdomain" checked={d.on} onChange={d.go} />
                    {d.label}
                  </label>
                ))}
              </div>
              <div className="seg">
                {V.popViews.map((v) => (
                  <label key={v.label} className="seg-opt">
                    <input type="radio" name="popview" checked={v.on} onChange={v.go} />
                    {v.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <PopulationChart pop={V.pop} />
        </section>
      </div>
    </div>
  );
}
