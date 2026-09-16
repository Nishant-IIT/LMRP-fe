interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  txt: string;
  tx: number;
  ty: number;
  fill: string;
  op: number;
  ink: string;
}

export interface ConfusionMatrixData {
  vb: string;
  cols: { label: string; x: number; y: number }[];
  rows: { label: string; lx: number; ly: number }[];
  cells: Cell[];
  axX: number;
  axY: number;
}

// Predicted-cluster confusion matrix for the early classifier: rows are the
// true (discovery-time) cluster, columns the model's prediction. Diagonal
// cells shade in accent; off-diagonal in ink.
export function ConfusionMatrix({ cm }: { cm: ConfusionMatrixData }) {
  return (
    <svg viewBox={cm.vb} style={{ width: "100%", height: "auto", marginTop: 8 }} role="img" aria-label="Confusion matrix">
      {cm.cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={c.fill} fillOpacity={c.op} />
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke="#f3f2f2" strokeWidth={2} />
        </g>
      ))}
      {cm.cols.map((c, i) => (
        <text key={"c" + i} x={c.x} y={c.y} fontSize={9} fill="currentColor" fillOpacity={0.55} textAnchor="middle" className="mono">
          {c.label}
        </text>
      ))}
      {cm.rows.map((r, i) => (
        <text key={"r" + i} x={r.lx} y={r.ly} fontSize={9} fill="currentColor" fillOpacity={0.55} textAnchor="end" className="mono">
          {r.label}
        </text>
      ))}
      {cm.cells.map((c, i) => (
        <text key={"m" + i} x={c.tx} y={c.ty} fontSize={11} fill={c.ink} fillOpacity={1} textAnchor="middle" className="mono">
          {c.txt}
        </text>
      ))}
      <text x={cm.axX} y={cm.axY} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.45} letterSpacing={1}>
        PREDICTED
      </text>
    </svg>
  );
}
