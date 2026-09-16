export interface HBarRow {
  label: string;
  color: string;
  pct: number;
  value: string;
}

// A "label + horizontal bar + value" list — cluster sizes at K (Discovery)
// and per-cluster bootstrap stability (Profiles) share this exact shape.
export function HBarList({ rows, valueWidth }: { rows: HBarRow[]; valueWidth: number }) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((b, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `88px minmax(0, 1fr) ${valueWidth}px`, gap: 10, alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 12 }}>
            {b.label}
          </span>
          <span style={{ height: 14, background: "var(--color-neutral-300)", display: "block" }}>
            <span style={{ display: "block", height: 14, background: b.color, width: `${b.pct}%` }} />
          </span>
          <span className="mono" style={{ fontSize: 12 }}>
            {b.value}
          </span>
        </div>
      ))}
    </div>
  );
}
