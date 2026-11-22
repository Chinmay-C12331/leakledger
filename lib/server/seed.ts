import { randomBytes, randomUUID } from "node:crypto";
import type { Report, Snapshot, Category } from "./types.ts";

export function authority(category: Category) {
  return (
    {
      water_leak: "Water Supply Dept.",
      road_damage: "Roads Dept.",
      other: "Ward Help Desk",
    }[category] + " (simulated)"
  );
}
export function trackingToken() {
  return randomBytes(32).toString("hex");
}
export function seed(): Snapshot {
  const submitted = "2026-11-21T04:12:00.000Z";
  const school = randomUUID(),
    stall = randomUUID();
  const common = {
    category: "water_leak",
    severity: "medium",
    severity_reason: "A resident describes an active pipe leak.",
    routed_to: authority("water_leak"),
    photo_path: null,
  } as const;
  const reports: Report[] = [
    {
      ...common,
      id: randomUUID(),
      tracking_token: trackingToken(),
      display_id: "LL-1043",
      description: "स्कूल के नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।",
      language: "hi",
      landmark: "Blue school gate",
      lat: 12.92904,
      lng: 77.58203,
      incident_id: null,
      submitted_at: submitted,
    },
    {
      ...common,
      id: randomUUID(),
      tracking_token: trackingToken(),
      display_id: "LL-1042",
      photo_path: "fixtures/school-gate.jpg",
      description:
        "Water is flowing from the pipe joint just outside the blue school gate.",
      language: "en",
      landmark: "Blue school gate",
      lat: 12.929,
      lng: 77.582,
      incident_id: school,
      submitted_at: "2026-11-21T03:46:00.000Z",
    },
    {
      ...common,
      id: randomUUID(),
      tracking_token: trackingToken(),
      display_id: "LL-1041",
      description:
        "The pipe behind the tea stall is leaking into the lane beside the counter.",
      language: "en",
      landmark: "Tea stall",
      lat: 12.92949,
      lng: 77.58238,
      incident_id: stall,
      submitted_at: "2026-11-21T03:24:00.000Z",
    },
  ];
  const incidents = reports
    .slice(1)
    .map((r) => ({
      id: r.incident_id!,
      lat: r.lat,
      lng: r.lng,
      representative_report_id: r.id,
      repair_status: "assigned" as const,
      created_at: r.submitted_at,
    }));
  // Explicitly staged examples, replaced for each new submission by the configured comparator.
  const reviews = incidents.map((i, k) => ({
    id: randomUUID(),
    report_id: reports[0].id,
    candidate_incident_id: i.id,
    officer_decision: "pending" as const,
    created_at: submitted,
    model_error: null,
    summary_en: "Water is leaking from a pipe joint near the blue school gate.",
    verdict: k === 0 ? ("likely_same" as const) : ("likely_different" as const),
    supporting:
      k === 0
        ? [
            {
              source: "landmark" as const,
              detail: "Both reports identify the blue school gate.",
            },
            {
              source: "text" as const,
              detail: "Both residents describe a leaking pipe joint.",
            },
          ]
        : [],
    conflicting:
      k === 1
        ? [
            {
              source: "landmark" as const,
              detail:
                "One report identifies the school gate and the other the tea stall.",
            },
          ]
        : [],
  }));
  return { reports, incidents, reviews, updates: [] };
}
