export type Language = "hi" | "en";
export type RepairStatus =
  "awaiting_review" | "assigned" | "under_repair" | "repaired";
export type Category = "water_leak" | "road_damage" | "other";
export type Severity = "low" | "medium" | "high";
export type Decision = "linked" | "separate" | "pending";

export interface ReportInput {
  description: string;
  language: Language;
  landmark: string;
  lat: number;
  lng: number;
  photo_path?: string | null;
}
export interface Triage {
  category: Category;
  severity: Severity | null;
  severity_reason: string | null;
}
export interface Report extends ReportInput, Triage {
  id: string;
  display_id: string;
  tracking_token: string;
  photo_path: string | null;
  routed_to: string;
  incident_id: string | null;
  submitted_at: string;
}
export interface Incident {
  id: string;
  lat: number;
  lng: number;
  representative_report_id: string;
  repair_status: RepairStatus;
  created_at: string;
}
export interface Evidence {
  detail: string;
  source: "text" | "photo" | "landmark";
}
export interface Comparison {
  summary_en: string;
  verdict: "likely_same" | "uncertain" | "likely_different";
  supporting: Evidence[];
  conflicting: Evidence[];
  model_error: string | null;
}
export interface ReviewInput extends Comparison {
  candidate_incident_id: string;
}
export interface MatchReview extends ReviewInput {
  id: string;
  report_id: string;
  officer_decision: Decision;
  created_at: string;
}
export interface RepairUpdate {
  id: string;
  incident_id: string;
  status: RepairStatus;
  public_note: string;
  created_at: string;
}
export interface Snapshot {
  reports: Report[];
  incidents: Incident[];
  reviews: MatchReview[];
  updates: RepairUpdate[];
}
export interface Dashboard {
  open: number;
  repaired: number;
  incidents: Pick<Incident, "id" | "lat" | "lng" | "repair_status">[];
  fixes: Pick<RepairUpdate, "status" | "public_note" | "created_at">[];
}
