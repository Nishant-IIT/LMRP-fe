export interface ClusterTrajectoryLine {
  name: string;
  color: string;
  w: number;
  dash: string;
  points: string;
  lx: number;
  ly: number;
}

export interface ClusterTrajectoryData {
  vb: string;
  zx1: number;
  zx2: number;
  zy: number;
  lines: ClusterTrajectoryLine[];
  xTicks: { x: number; y: number; label: string }[];
  ariaLabel: string;
}

// Standardised (proportion-of-baseline) trajectories for every measure in
// one cluster — a Profiles card's chart. Lower is more recovered.
export function ClusterTrajectoryChart({ c }: { c: ClusterTrajectoryData }) {
  return (
    <svg viewBox={c.vb} style={{ width: "100%", height: "auto", marginTop: 12 }} role="img" aria-label={c.ariaLabel}>
      <line x1={c.zx1} y1={c.zy} x2={c.zx2} y2={c.zy} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
      {c.lines.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color} strokeWidth={l.w} strokeDasharray={l.dash} />
      ))}
      {c.lines.map((l, i) => (
        <text key={"l" + i} x={l.lx} y={l.ly} fontSize={9} fill={l.color} fillOpacity={1} className="mono">
          {l.name}
        </text>
      ))}
      {c.xTicks.map((t, i) => (
        <text key={"x" + i} x={t.x} y={t.y} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" className="mono">
          {t.label}
        </text>
      ))}
    </svg>
  );
}
