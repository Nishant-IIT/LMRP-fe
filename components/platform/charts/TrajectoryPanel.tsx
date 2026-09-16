import { Info } from "../InfoTip";

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

export interface TrajectoryPanelData {
  domain: string;
  name: string;
  unit: string;
  dirNote: string;
  vb: string;
  bandD: string;
  popPoints: string;
  segs: { points: string }[];
  dots: { x: number; y: number }[];
  gaps: { x: number; y: number }[];
  yTicks: AxisTick[];
  xTicks: XTick[];
}

// One measure's trajectory for the selected participant: their own line in
// red, the cohort mean dashed, and the cohort interquartile range shaded.
export function TrajectoryPanel({ p }: { p: TrajectoryPanelData }) {
  return (
    <figure style={{ background: "var(--color-bg)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="lbl">{p.domain}</span>
        <span className="mono" style={{ fontSize: 11 }}>
          {p.name}
          {p.unit} · {p.dirNote}
        </span>
      </div>
      <svg viewBox={p.vb} style={{ width: "100%", height: "auto", marginTop: 6 }} role="img" aria-label={`${p.name} trajectory`}>
        {p.yTicks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} stroke="currentColor" strokeOpacity={0.14} />
        ))}
        <path d={p.bandD} fill="currentColor" fillOpacity={0.08} />
        <polyline points={p.popPoints} fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 3" />
        {p.segs.map((s, i) => (
          <polyline key={i} points={s.points} fill="none" stroke="#ec3013" strokeWidth={2.5} />
        ))}
        {p.dots.map((d, i) => (
          <rect key={i} x={d.x} y={d.y} width={6} height={6} fill="#ec3013" />
        ))}
        {p.gaps.map((g, i) => (
          <rect key={i} x={g.x} y={g.y} width={7} height={7} fill="none" stroke="#ec3013" strokeWidth={1.5} />
        ))}
        {p.yTicks.map((t, i) => (
          <text key={"y" + i} x={t.lx} y={t.ly} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="end" className="mono">
            {t.label}
          </text>
        ))}
        {p.xTicks.map((t, i) => (
          <text key={"x" + i} x={t.x} y={t.y} fontSize={9} fill="currentColor" fillOpacity={0.55} textAnchor="middle" className="mono">
            {t.label}
          </text>
        ))}
      </svg>
      <figcaption>
        Red: this participant. Dashed: cohort mean. Shaded: cohort interquartile range. Hollow squares on the axis
        mark a missed assessment.
        <Info id="iqr" />
      </figcaption>
    </figure>
  );
}
