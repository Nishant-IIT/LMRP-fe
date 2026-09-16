"use client";

import { InfoTipProvider, Info } from "./InfoTip";

export function RecoveryPhenotypingPlatform() {
  return (
    <InfoTipProvider>
      <div style={{ padding: 24 }}>
        Loading… <Info id="silhouette" />
      </div>
    </InfoTipProvider>
  );
}
