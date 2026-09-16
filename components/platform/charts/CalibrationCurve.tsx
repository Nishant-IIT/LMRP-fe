export interface CalibrationTick {
  x: number;
  y: number;
  label: string;
  anchor: "start" | "middle" | "end";
}

export interface CalibrationCurveData {
  vb: string;
  d1x: number;
  d1y: number;
  d2x: number;
  d2y: number;
  points: string;
  dots: { x: number; y: number }[];
  ticks: CalibrationTick[];
}

// Reliability curve: observed accuracy vs. predicted confidence over 5
// bins, against the perfectly-calibrated diagonal.
export function CalibrationCurve({ cal }: { cal: CalibrationCurveData }) {
  return (
    <svg viewBox={cal.vb} style={{ width: "100%", height: "auto", marginTop: 8 }} role="img" aria-label="Calibration curve">
      <line x1={cal.d1x} y1={cal.d1y} x2={cal.d2x} y2={cal.d2y} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 3" />
      <polyline points={cal.points} fill="none" stroke="#ec3013" strokeWidth={2} />
      {cal.dots.map((d, i) => (
        <rect key={i} x={d.x} y={d.y} width={6} height={6} fill="#ec3013" />
      ))}
      {cal.ticks.map((t, i) => (
        <text key={i} x={t.x} y={t.y} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor={t.anchor} className="mono">
          {t.label}
        </text>
      ))}
    </svg>
  );
}
