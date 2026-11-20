// Reads real enrolment/assessment data from the LMRP-Be backend (via
// PostgREST) and reshapes it into the same Cohort/Participant/Observation
// and Measure shapes the existing synthetic-data screens already consume --
// so Dashboard/Participants/Measures can render real data through
// essentially unchanged rendering code.
import type { Cohort, Measure, MeasureId, Observation, Participant } from "@/lib/types";
import { TIMEPOINTS } from "@/lib/phenotype-engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function restHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

// Backend row shapes (snake_case, as PostgREST returns them).
interface RealParticipant {
  id: number;
  sid: string;
  age: number;
  sex: "F" | "M";
  bmi: number;
  duration_weeks: number;
  episodes: number;
  site: string;
}

interface RealObservation {
  participant_id: number;
  timepoint_id: string;
  assessed: boolean;
  nprs: number | null;
  sts: number | null;
  odi_items: (number | null)[] | null;
  fabq_items: (number | null)[] | null;
  items_missing: number | null;
}

// The frontend's own TIMEPOINTS schedule (T0/T1/T2/T3/T4/T5 at weeks
// 0/2/4/6/8/12) predates the real backend's schedule (T0/W2/W4/W8/W12/W24)
// and the two don't fully line up -- week 6 (frontend-only) and week 24
// (backend-only) have no counterpart on the other side. Real observations
// at W24 currently have nowhere to render in these screens; that's a known
// gap, not a bug, until the two schedules are unified.
const WEEK_TO_BACKEND_TIMEPOINT: Record<number, string> = { 0: "T0", 2: "W2", 4: "W4", 8: "W8", 12: "W12" };

function odiIndex(items: (number | null)[] | null): number | null {
  const answered = (items ?? []).filter((v): v is number => v !== null);
  if (!answered.length) return null;
  const raw = answered.reduce((a, b) => a + b, 0);
  return (100 * raw) / (5 * answered.length);
}

function fabqSum(items: (number | null)[] | null): number | null {
  const answered = (items ?? []).filter((v): v is number => v !== null);
  if (!answered.length) return null;
  return answered.reduce((a, b) => a + b, 0);
}

function buildObs(real: RealObservation | undefined): Observation {
  if (!real || !real.assessed) return { tp: "", missing: true, values: {} };
  const values: Partial<Record<MeasureId, number | null>> = {
    nprs: real.nprs,
    sts: real.sts,
    odi: odiIndex(real.odi_items),
    fabq: fabqSum(real.fabq_items),
  };
  const present = Object.values(values).filter((v) => v !== null).length;
  return { tp: "", missing: false, values, complete: present / 4, itemsMissing: real.items_missing ?? 0 };
}

// Lightweight participant list for the Assessment Entry picker -- kept
// separate from fetchRealCohort() because that function reshapes rows into
// the shared Participant type (also used by synthetic-data screens), which
// has no numeric `id` field. submit-assessment needs the real id.
export async function fetchRealParticipants(): Promise<{ id: number; sid: string }[]> {
  return restGet<{ id: number; sid: string }[]>("participants?select=id,sid&order=id.asc");
}

// Full editable record for the Enrolment screen's edit mode -- distinct
// from fetchRealParticipants() (id+sid only) and fetchRealCohort() (reshaped
// for the trajectory-chart screens, drops most raw fields).
export interface RealParticipantDetail {
  id: number;
  sid: string;
  enrolled_at: string;
  age: number;
  sex: "F" | "M";
  height_cm: number;
  weight_kg: number;
  duration_weeks: number;
  episodes: number;
  occupational_load: "low" | "moderate" | "high";
  site: string;
  consent: boolean;
  inclusion_answers: boolean[];
  exclusion_answers: boolean[];
}

export async function fetchParticipantDetail(id: number): Promise<RealParticipantDetail> {
  const rows = await restGet<RealParticipantDetail[]>(
    `participants?id=eq.${id}&select=id,sid,enrolled_at,age,sex,height_cm,weight_kg,duration_weeks,episodes,occupational_load,site,consent,inclusion_answers,exclusion_answers`
  );
  if (!rows.length) throw new Error(`No participant with id ${id}`);
  return rows[0];
}

export async function fetchRealCohort(): Promise<Cohort> {
  const [participants, observations] = await Promise.all([
    restGet<RealParticipant[]>("participants?select=id,sid,age,sex,bmi,duration_weeks,episodes,site"),
    restGet<RealObservation[]>(
      "observations?select=participant_id,timepoint_id,assessed,nprs,sts,odi_items,fabq_items,items_missing"
    ),
  ]);

  const byParticipant = new Map<number, RealObservation[]>();
  for (const o of observations) {
    const list = byParticipant.get(o.participant_id) ?? [];
    list.push(o);
    byParticipant.set(o.participant_id, list);
  }

  const mapped: Participant[] = participants.map((p) => {
    const obsForP = byParticipant.get(p.id) ?? [];
    const obs: Observation[] = TIMEPOINTS.map((tp) => {
      const backendId = WEEK_TO_BACKEND_TIMEPOINT[tp.week];
      const real = backendId ? obsForP.find((o) => o.timepoint_id === backendId) : undefined;
      return { ...buildObs(real), tp: tp.id };
    });
    return {
      sid: p.sid,
      pattern: -1, // no ground-truth pattern for real participants
      age: p.age,
      sex: p.sex,
      bmi: p.bmi,
      durationWeeks: p.duration_weeks,
      episodes: p.episodes,
      conventional: "unknown",
      site: p.site,
      obs,
    };
  });

  return { participants: mapped, flags: [], n: mapped.length, seed: 0, version: "real" };
}

interface RealMeasure {
  id: MeasureId;
  domain: string;
  name: string;
  full_name: string;
  min: number;
  max: number;
  direction: "worse" | "better";
  item_count: number;
  unit: string | null;
  active: boolean;
}

export async function fetchMeasures(): Promise<Measure[]> {
  const rows = await restGet<RealMeasure[]>("measures?select=*");
  return rows.map((m) => ({
    id: m.id,
    domain: m.domain,
    name: m.name,
    full: m.full_name,
    min: m.min,
    max: m.max,
    dir: m.direction,
    items: m.item_count,
    unit: m.unit ?? undefined,
    active: m.active,
  }));
}

export async function updateMeasure(id: MeasureId, patch: { active?: boolean; dir?: "worse" | "better" }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.dir !== undefined) body.direction = patch.dir;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/measures?id=eq.${id}`, {
    method: "PATCH",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to update measure ${id} (${res.status}): ${text}`);
  }
}
