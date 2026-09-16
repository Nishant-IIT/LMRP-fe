"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

interface TipState {
  id: string;
  left: number;
  top: number;
  pinned: boolean;
}

interface InfoTipContextValue {
  tip: TipState | null;
  show: (id: string, el: HTMLElement) => void;
  pin: (id: string, el: HTMLElement) => void;
  close: () => void;
}

const InfoTipContext = createContext<InfoTipContextValue | null>(null);

export function InfoTipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  // Mirrors `tip` so event handlers below can read the just-set value
  // synchronously (React state updates aren't visible until the next
  // render). Written only outside of render, from these same callbacks.
  const tipRef = useRef<TipState | null>(null);

  const setBoth = useCallback((next: TipState | null) => {
    tipRef.current = next;
    setTip(next);
  }, []);

  const place = useCallback(
    (id: string, el: HTMLElement, pinned: boolean) => {
      const r = el.getBoundingClientRect();
      const left = Math.max(10, Math.min(r.left - 8, window.innerWidth - 300));
      const below = r.bottom + 10;
      const top = below + 190 > window.innerHeight ? Math.max(10, r.top - 200) : below;
      setBoth({ id, left: Math.round(left), top: Math.round(top), pinned });
    },
    [setBoth]
  );

  const show = useCallback(
    (id: string, el: HTMLElement) => {
      if (!(tipRef.current && tipRef.current.pinned)) place(id, el, false);
    },
    [place]
  );

  const pin = useCallback(
    (id: string, el: HTMLElement) => {
      const t = tipRef.current;
      if (t && t.id === id && t.pinned) setBoth(null);
      else place(id, el, true);
    },
    [place, setBoth]
  );

  const close = useCallback(() => {
    if (!(tipRef.current && tipRef.current.pinned)) setBoth(null);
  }, [setBoth]);

  const closeAlways = useCallback(() => setBoth(null), [setBoth]);

  useEffect(() => {
    document.addEventListener("click", closeAlways);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAlways();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeAlways, true);
    return () => {
      document.removeEventListener("click", closeAlways);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeAlways, true);
    };
  }, [closeAlways]);

  const g = tip ? GLOSSARY[tip.id] : null;

  return (
    <InfoTipContext.Provider value={{ tip, show, pin, close }}>
      {children}
      {tip && g && (
        <div
          style={{
            position: "fixed",
            left: tip.left,
            top: tip.top,
            width: 288,
            zIndex: 60,
            background: "var(--color-bg)",
            border: "2px solid var(--color-text)",
            boxShadow: "var(--shadow-lg)",
            padding: "13px 14px 14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div className="lbl" style={{ color: "var(--color-accent-700)" }}>
              {g.t}
            </div>
            <span className="lbl mono" style={{ whiteSpace: "nowrap" }}>
              {g.h || ""}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "7px 0 0", textWrap: "pretty" }}>{g.b}</p>
          {g.r && (
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--color-divider)" }}>
              <div className="lbl">How to read it here</div>
              <p style={{ fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" }}>{g.r}</p>
            </div>
          )}
        </div>
      )}
    </InfoTipContext.Provider>
  );
}

export function Info({ id }: { id: keyof typeof GLOSSARY }) {
  const ctx = useContext(InfoTipContext);
  if (!ctx) throw new Error("Info must be used within InfoTipProvider");
  const { tip, show, pin, close } = ctx;
  const g = GLOSSARY[id];
  const isOpen = tip?.id === id;
  return (
    <button
      type="button"
      className="info"
      aria-expanded={isOpen}
      aria-label={`What is ${g.t}?`}
      onMouseEnter={(e) => show(id, e.currentTarget)}
      onMouseLeave={close}
      onClick={(e) => {
        e.stopPropagation();
        pin(id, e.currentTarget);
      }}
    >
      i
    </button>
  );
}
