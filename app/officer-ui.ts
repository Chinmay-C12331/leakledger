import type { RepairStatus, Snapshot } from "../lib/server/types";

export type OfficerQueue = Snapshot & {
  model_mode: "live" | "demo" | "unavailable";
  storage_mode: "local" | "supabase";
};
export const statusNames: Record<RepairStatus, string> = {
  awaiting_review: "Needs review",
  assigned: "Assigned",
  under_repair: "Under repair",
  repaired: "Repaired",
};
export const categoryNames: Record<string, string> = {
  water_leak: "Water leak",
  road_damage: "Road damage",
  other: "Other",
};
export async function sendOfficerAction(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? "The change could not be saved. Try again.");
  }
}
