import { Info } from "../InfoTip";
import type { GLOSSARY } from "@/lib/glossary";

export interface MetricLineChartData {
  title: string;
  hint: string;
  infoId: keyof typeof GLOSSARY;
  vb: string;
  selLabel: string;
  points: string;
  dots: { x: number; y: number; s: number; fill: string }[];
  yTicks: { y: number; x1: number; x2: number; lx: number; ly: number; label: string }[];
  xTicks: { x: number; y: number; label: string; ink: string }[];
}

// Cluster-quality-vs-K line chart, one instance per metric (silhouette,
// Calinski-Harabasz, Davies-Bouldin, within-cluster SS) on the Discovery
// screen. The current K's point is drawn larger, in accent color.
export function MetricLineChart({ ch }: { ch: MetricLineChartData }) {
  return (
    <figure style={{ background: "var(--color-bg)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="lbl">
          {ch.title}
          <Info id={ch.infoId} />
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--color-accent-700)" }}>
          {ch.selLabel}
        </span>
      </div>
      <svg viewBox={ch.vb} style={{ width: "100%", height: "auto", marginTop: 6 }} role="img" aria-label={`${ch.title} by K`}>
        {ch.yTicks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} stroke="currentColor" strokeOpacity={0.14} />
        ))}
        <polyline points={ch.points} fill="none" stroke="#201e1d" strokeWidth={1.75} />
        {ch.dots.map((d, i) => (
          <rect key={i} x={d.x} y={d.y} width={d.s} height={d.s} fill={d.fill} />
        ))}
        {ch.yTicks.map((t, i) => (
          <text key={"y" + i} x={t.lx} y={t.ly} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="end" className="mono">
            {t.label}
          </text>
        ))}
        {ch.xTicks.map((t, i) => (
          <text key={"x" + i} x={t.x} y={t.y} fontSize={9} fill={t.ink} fillOpacity={t.ink === "#ec3013" ? 1 : 0.6} textAnchor="middle" className="mono">
            {t.label}
          </text>
        ))}
      </svg>
      <figcaption>{ch.hint}</figcaption>
    </figure>
  );
}
