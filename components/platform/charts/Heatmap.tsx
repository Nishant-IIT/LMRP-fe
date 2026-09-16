interface HeatmapCell {
  x: number;
  y: number;
  w: number;
  h: number;
  op: number;
  tx: number;
  ty: number;
  txt: string;
  ink: string;
}

interface HeatmapProps {
  viewBox: string;
  cols: { label: string; x: number; y: number }[];
  rows: { label: string; y: number }[];
  cells: HeatmapCell[];
  ariaLabel: string;
}

// The Dashboard's missingness grid: a fixed-color (accent) heat grid with a
// column header row, a row label column, and a percentage in every cell.
export function Heatmap({ viewBox, cols, rows, cells, ariaLabel }: HeatmapProps) {
  return (
    <svg viewBox={viewBox} style={{ width: "100%", height: "auto", marginTop: 8 }} role="img" aria-label={ariaLabel}>
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#ec3013" fillOpacity={c.op} />
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke="#f3f2f2" strokeWidth={2} />
        </g>
      ))}
      {cols.map((c, i) => (
        <text key={"hc" + i} x={c.x} y={c.y} fontSize={9} fill="currentColor" fillOpacity={0.55} textAnchor="middle" letterSpacing={1}>
          {c.label}
        </text>
      ))}
      {rows.map((r, i) => (
        <text key={"hr" + i} x={0} y={r.y} fontSize={11} fill="currentColor" fillOpacity={0.9}>
          {r.label}
        </text>
      ))}
      {cells.map((c, i) => (
        <text key={"hx" + i} x={c.tx} y={c.ty} fontSize={10} fill={c.ink} fillOpacity={1} textAnchor="middle" className="mono">
          {c.txt}
        </text>
      ))}
    </svg>
  );
}
