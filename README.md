# RE:PHENO — Recovery Phenotyping Platform

An MSK (musculoskeletal) recovery phenotyping research tool, built with Next.js (App Router) and TypeScript. It runs entirely client-side against a synthetic, seeded cohort: enrolment and assessment entry, data quality, phenotype discovery (k-means / hierarchical / Gaussian-mixture clustering with cluster-quality metrics and bootstrap stability), cluster profiling, and early classification (logistic regression / random forest) of cluster membership from partial follow-up data.

Styled with the "Modernist" design system (flat, red-on-white, zero border-radius, Archivo type) — see `app/globals.css`.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `components/platform/RecoveryPhenotypingPlatform.tsx` — top-level state container and all business logic (clustering runs, bootstrap, classification, CSV exports).
- `components/platform/screens/` — the 9 screens (Dashboard, Enrolment, Participants, Assessment entry, Measures, Discovery, Solutions, Profiles, Classification).
- `components/platform/charts/` — shared inline-SVG chart primitives.
- `lib/phenotype-engine.ts` — the analysis engine: synthetic cohort generator, clustering adapters, cluster metrics, bootstrap, classifiers. Deterministic from its seed.
- `lib/glossary.ts` — the in-app glossary surfaced by every "i" info button.

## Testing

```bash
npm test        # vitest — unit tests for the analysis engine
npx tsc --noEmit # type check
npm run lint     # eslint
npm run build    # production build
```

The engine (`lib/phenotype-engine.ts`) has unit test coverage since its numerics have no other correctness signal. The 9 screens are presentational translations of a fully-specified design and are verified by running the app.
