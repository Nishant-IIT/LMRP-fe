"use client";

import { SCREENS, type ScreenId } from "@/lib/types";
import { Info } from "./InfoTip";

interface NavProps {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
  onOpenRecord: () => void;
  datasetVersion: string;
  seed: number;
}

export function Nav({ screen, onNavigate, onOpenRecord, datasetVersion, seed }: NavProps) {
  return (
    <>
      <nav
        className="nav"
        style={{ gap: 20, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 20, background: "var(--color-bg)" }}
      >
        <div className="nav-brand" style={{ marginRight: 8, lineHeight: 1.05 }}>
          RE:PHENO
          <div className="lbl" style={{ fontSize: 9, marginTop: 2 }}>
            MSK recovery phenotyping · MVP
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginRight: "auto" }}>
          {SCREENS.map((item) => (
            <button
              key={item.id}
              className="navbtn"
              type="button"
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" type="button" onClick={onOpenRecord} style={{ gap: 8 }}>
          <span style={{ width: 7, height: 7, background: "var(--color-accent)", display: "block" }} />
          Analysis record
        </button>
      </nav>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          flexWrap: "wrap",
          padding: "8px 16px",
          borderBottom: "2px solid var(--color-divider)",
          background: "var(--color-accent-100)",
        }}
      >
        <span className="tag tag-accent" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
          SYNTHETIC DATA MODE
          <Info id="synthetic" />
        </span>
        <span style={{ fontSize: 12 }}>
          No real participants. Generator: 300 cases · 6 timepoints · 4 known latent patterns · controlled
          missingness · measurement noise. Use this to check that the pipeline recovers patterns it was given.
        </span>
        <span className="lbl" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          every{" "}
          <span className="info" style={{ cursor: "default" }}>
            i
          </span>{" "}
          explains a term
        </span>
        <span className="lbl mono">
          dataset {datasetVersion} · seed {seed}
        </span>
      </div>
    </>
  );
}
