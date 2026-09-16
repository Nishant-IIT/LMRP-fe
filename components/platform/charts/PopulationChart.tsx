interface AxisTick {
  x1: number;
  x2: number;
  y: number;
  lx: number;
  ly: number;
  label: string;
}
interface XTick {
  x: number;
  y: number;
  label: string;
}

export interface PopulationChartData {
  vb: string;
  spaghetti: { points: string; color: string }[];
  bandOp: number;
  bandD: string;
  meanPoints: string;
  medianPoints: string;
  meanW: number;
  medW: number;
  yTicks: AxisTick[];
  xTicks: XTick[];
  ns: XTick[];
  caption: string;
}

// The whole cohort at once: individual trajectories (spaghetti, coloured by
// current cluster), the mean with a 95% CI band, and the median — toggled
// independently by the Participants screen's domain/view controls.
export function PopulationChart({ pop }: { pop: PopulationChartData }) {
  return (
    <>
      <svg viewBox={pop.vb} style={{ width: "100%", height: "auto", marginTop: 12 }} role="img" aria-label="Population trajectories">
        {pop.yTicks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} stroke="currentColor" strokeOpacity={0.14} />
        ))}
        {pop.spaghetti.map((s, i) => (
          <polyline key={i} points={s.points} fill="none" stroke={s.color} strokeOpacity={0.3} strokeWidth={1} />
        ))}
        <path d={pop.bandD} fill="#ec3013" fillOpacity={pop.bandOp} />
        <polyline points={pop.meanPoints} fill="none" stroke="#ec3013" strokeWidth={pop.meanW} />
        <polyline points={pop.medianPoints} fill="none" stroke="#201e1d" strokeWidth={pop.medW} strokeDasharray="5 4" />
        {pop.yTicks.map((t, i) => (
          <text key={"y" + i} x={t.lx} y={t.ly} fontSize={10} fill="currentColor" fillOpacity={1} textAnchor="end" className="mono">
            {t.label}
          </text>
        ))}
        {pop.xTicks.map((t, i) => (
          <text key={"x" + i} x={t.x} y={t.y} fontSize={10} fill="currentColor" fillOpacity={0.55} textAnchor="middle" className="mono">
            {t.label}
          </text>
        ))}
        {pop.ns.map((t, i) => (
          <text key={"n" + i} x={t.x} y={t.y} fontSize={9} fill="currentColor" fillOpacity={0.4} textAnchor="middle" className="mono">
            {t.label}
          </text>
        ))}
      </svg>
      <p className="text-muted" style={{ fontSize: 12 }}>
        {pop.caption}
      </p>
    </>
  );
}
