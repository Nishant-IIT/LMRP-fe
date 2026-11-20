// Thin client for the LMRP-Be Supabase Edge Functions (enroll, submit-assessment).
// Shares NEXT_PUBLIC_SUPABASE_URL with lib/real-data.ts's PostgREST client --
// both are the same Supabase gateway (Kong), just different routed paths
// (/functions/v1 here vs. /rest/v1 there).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const API_BASE = `${SUPABASE_URL}/functions/v1`;
// Hosted Edge Functions have JWT verification on by default (local
// `supabase functions serve --no-verify-jwt` skips it, which is why this
// was missing until a hosted deploy surfaced it) -- the gateway rejects
// any request with no Authorization header before it ever reaches the
// function. The anon key is the right credential here: this app has no
// Supabase Auth login, so every client calls as anon, same as the
// PostgREST reads in lib/real-data.ts already do.
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface ApiErrorBody {
  error?: { code: string; message: string };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Request to ${path} failed (${res.status})`);
  }
  return data as T;
}

export interface EnrollPayload {
  age: number;
  sex: "F" | "M";
  height_cm: number;
  weight_kg: number;
  duration_weeks: number;
  episodes: number;
  occupational_load: "low" | "moderate" | "high";
  site: string;
  consent: boolean;
  inclusion: boolean[];
  exclusion: boolean[];
}

export interface EnrollResult {
  participant: { id: number; sid: string; enrolled_at: string };
  schedule: { id: number; timepoint_id: string }[];
}

export function enrollParticipant(payload: EnrollPayload): Promise<EnrollResult> {
  return postJson<EnrollResult>("enroll", payload);
}

export interface UpdateParticipantPayload extends EnrollPayload {
  participant_id: number;
}

export interface UpdateParticipantResult {
  participant: EnrollResult["participant"];
}

export function updateParticipant(payload: UpdateParticipantPayload): Promise<UpdateParticipantResult> {
  return postJson<UpdateParticipantResult>("update-participant", payload);
}

export interface SubmitAssessmentPayload {
  participant_id: number;
  timepoint_id: string;
  nprs: number | null;
  sts: number | null;
  odi_items: (number | null)[];
  fabq_items: (number | null)[];
}

export interface SubmitAssessmentResult {
  id: number;
  valid: boolean;
  items_missing: number;
  raw_score: number | null;
  normalized_score: number | null;
}

export function submitAssessment(payload: SubmitAssessmentPayload): Promise<SubmitAssessmentResult> {
  return postJson<SubmitAssessmentResult>("submit-assessment", payload);
}
