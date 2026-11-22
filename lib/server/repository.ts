import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type {
  Dashboard,
  Decision,
  RepairStatus,
  Report,
  ReportInput,
  ReviewInput,
  Snapshot,
  Triage,
} from "./types.ts";
import { authority, seed, trackingToken } from "./seed.ts";

export class RepoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}
// One SQLite transaction serializes each local read-modify-write, even across Node processes.
function local<T>(operation: (db: DatabaseSync) => T): T {
  const directory =
    process.env.LEAKLEDGER_DATA_DIR || join(tmpdir(), "leakledger-ward-v2");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, "ledger.sqlite"));
  try {
    db.exec("PRAGMA busy_timeout=10000; BEGIN IMMEDIATE");
    db.exec(
      "CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS photos(path TEXT PRIMARY KEY,mime TEXT NOT NULL, bytes BLOB NOT NULL)",
    );
    if (!db.prepare("SELECT id FROM ledger WHERE id=1").get())
      db.prepare("INSERT INTO ledger VALUES (1,?)").run(JSON.stringify(seed()));
    const result = operation(db);
    db.exec("COMMIT");
    return result;
  } finally {
    db.close();
  } // Closing rolls back an uncommitted transaction.
}
function withState<T>(write: boolean, fn: (state: Snapshot) => T): T {
  return local((db) => {
    const state: Snapshot = JSON.parse(
      String(db.prepare("SELECT value FROM ledger WHERE id=1").get()!.value),
    );
    const result = fn(state);
    if (write)
      db.prepare("UPDATE ledger SET value=? WHERE id=1").run(
        JSON.stringify(state),
      );
    return result;
  });
}
async function request(path: string, init: RequestInit = {}) {
  const { url, key } = config()!;
  const res = await fetch(url + path, {
    ...init,
    headers: { apikey: key, Authorization: "Bearer " + key, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    // Only expose controlled domain messages. Provider errors can contain submitted data.
    const error = await res.json().catch(() => ({}));
    if (error.code === "P0002") throw new RepoError(404, "Record not found.");
    if (error.code === "P0001" || error.code === "23505")
      throw new RepoError(
        409,
        "The decision conflicts with the current report or incident.",
      );
    throw new RepoError(503, "Ward storage is unavailable.");
  }
  return res;
}
async function rpc<T>(name: string, args: object = {}): Promise<T> {
  const res = await request("/rest/v1/rpc/ll_" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  return body ? JSON.parse(body) : undefined;
}
function findReport(s: Snapshot, id: string) {
  const r = s.reports.find((r) => r.id === id);
  if (!r) throw new RepoError(404, "Report not found.");
  return r;
}
function findIncident(s: Snapshot, id: string) {
  const i = s.incidents.find((i) => i.id === id);
  if (!i) throw new RepoError(404, "Incident not found.");
  return i;
}
function upsertReview(s: Snapshot, r: Report, input: ReviewInput) {
  findIncident(s, input.candidate_incident_id);
  const previous = s.reviews.find(
    (v) =>
      v.report_id === r.id &&
      v.candidate_incident_id === input.candidate_incident_id,
  );
  const decision = r.incident_id
    ? r.incident_id === input.candidate_incident_id
      ? "linked"
      : "separate"
    : "pending";
  if (previous)
    Object.assign(previous, input, {
      officer_decision:
        previous.officer_decision === "pending"
          ? decision
          : previous.officer_decision,
    });
  else
    s.reviews.push({
      ...input,
      id: randomUUID(),
      report_id: r.id,
      officer_decision: decision,
      created_at: new Date().toISOString(),
    });
}
function latestUpdates(s: Snapshot) {
  return [...s.updates]
    .reverse()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
function safePath(path: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path))
    throw new RepoError(400, "Invalid photo path.");
}
export const repo = {
  get mode(): "supabase" | "local" {
    return config() ? "supabase" : "local";
  },
  async snapshot(): Promise<Snapshot> {
    return config() ? rpc("snapshot") : withState(false, (s) => s);
  },
  async createReport(input: ReportInput): Promise<Report> {
    if (config()) {
      const res = await request("/rest/v1/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(input),
      });
      return (await res.json())[0];
    }
    return withState(true, (s) => {
      const number =
        Math.max(1043, ...s.reports.map((r) => Number(r.display_id.slice(3)))) +
        1;
      const report: Report = {
        ...input,
        photo_path: input.photo_path ?? null,
        id: randomUUID(),
        display_id: "LL-" + number,
        tracking_token: trackingToken(),
        incident_id: null,
        category: "other",
        severity: null,
        severity_reason: null,
        routed_to: authority("other"),
        submitted_at: new Date().toISOString(),
      };
      s.reports.unshift(report);
      return report;
    });
  },
  async saveAnalysis(
    reportId: string,
    triage: Triage,
    reviews: ReviewInput[],
  ): Promise<void> {
    if (config())
      return rpc("analysis", {
        rid: reportId,
        triage: { ...triage, routed_to: authority(triage.category) },
        items: reviews,
      });
    withState(true, (s) => {
      const report = findReport(s, reportId);
      Object.assign(report, triage, { routed_to: authority(triage.category) });
      for (const input of reviews) upsertReview(s, report, input);
    });
  },
  async decide(
    reportId: string,
    decision: Decision,
    incidentId?: string,
  ): Promise<void> {
    if (config())
      return rpc("decide", {
        rid: reportId,
        choice: decision,
        cid: incidentId ?? null,
      });
    withState(true, (s) => {
      const r = findReport(s, reportId);
      if (r.incident_id) {
        const current = findIncident(s, r.incident_id);
        if (
          (decision === "linked" && incidentId === current.id) ||
          (decision === "separate" && current.representative_report_id === r.id)
        )
          return;
        throw new RepoError(409, "This report has already been assigned.");
      }
      if (decision === "pending") return;
      const now = new Date().toISOString();
      if (decision === "linked") {
        const candidate = findIncident(s, incidentId ?? "");
        if (candidate.repair_status === "repaired")
          throw new RepoError(409, "This incident is already repaired.");
        r.incident_id = candidate.id;
      } else if (decision === "separate") {
        if (incidentId) findIncident(s, incidentId);
        const newId = randomUUID();
        s.incidents.unshift({
          id: newId,
          lat: r.lat,
          lng: r.lng,
          representative_report_id: r.id,
          repair_status: "assigned",
          created_at: now,
        });
        r.incident_id = newId;
      } else throw new RepoError(400, "Invalid decision.");
      if (
        incidentId &&
        !s.reviews.some(
          (v) => v.report_id === r.id && v.candidate_incident_id === incidentId,
        )
      )
        upsertReview(s, r, {
          candidate_incident_id: incidentId,
          summary_en: "Manual officer review.",
          verdict: "uncertain",
          supporting: [],
          conflicting: [],
          model_error: null,
        });
      for (const v of s.reviews.filter((v) => v.report_id === r.id))
        v.officer_decision =
          v.candidate_incident_id === r.incident_id ? "linked" : "separate";
    });
  },
  async repair(
    incidentId: string,
    status: RepairStatus,
    publicNote: string,
  ): Promise<void> {
    if (config())
      return rpc("repair", {
        cid: incidentId,
        new_status: status,
        note: publicNote,
      });
    withState(true, (s) => {
      const i = findIncident(s, incidentId),
        last = latestUpdates(s).find((u) => u.incident_id === i.id);
      if (last && last.status === status && last.public_note === publicNote)
        return;
      i.repair_status = status;
      s.updates.push({
        id: randomUUID(),
        incident_id: i.id,
        status,
        public_note: publicNote,
        created_at: new Date().toISOString(),
      });
    });
  },
  async track(
    token: string,
  ): Promise<{ status: RepairStatus; public_note: string | null } | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    if (config()) return rpc("track", { token });
    return withState(false, (s) => {
      const r = s.reports.find((r) => r.tracking_token === token);
      if (!r) return null;
      const i = s.incidents.find((i) => i.id === r.incident_id);
      return {
        status: i?.repair_status ?? "awaiting_review",
        public_note:
          latestUpdates(s).find((u) => u.incident_id === i?.id)?.public_note ??
          null,
      };
    });
  },
  async dashboard(): Promise<Dashboard> {
    if (config()) return rpc("dashboard");
    return withState(false, (s) => {
      const incidents = s.incidents.map((i) => ({
        id: i.id,
        lat: Number(i.lat.toFixed(4)),
        lng: Number(i.lng.toFixed(4)),
        repair_status: i.repair_status,
      }));
      const fixed = new Set(
        incidents
          .filter((i) => i.repair_status === "repaired")
          .map((i) => i.id),
      );
      const fixes = latestUpdates(s)
        .filter((u) => u.status === "repaired" && fixed.delete(u.incident_id))
        .slice(0, 10)
        .map(({ status, public_note, created_at }) => ({
          status,
          public_note,
          created_at,
        }));
      const repaired = incidents.filter(
        (i) => i.repair_status === "repaired",
      ).length;
      return { open: incidents.length - repaired, repaired, incidents, fixes };
    });
  },
  async uploadPhoto(bytes: Uint8Array, mime: string): Promise<string> {
    if (!extensions[mime] || !bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new RepoError(400, "Invalid photo.");
    const path = randomUUID() + "." + extensions[mime];
    if (config())
      await request("/storage/v1/object/report-photos/" + path, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: new Uint8Array(bytes),
      });
    else
      local((db) =>
        db.prepare("INSERT INTO photos VALUES (?,?,?)").run(path, mime, bytes),
      );
    return path;
  },
  async readPhoto(
    path: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | null> {
    // A staged photo is bundled for the seeded representative only.
    if (path === "fixtures/school-gate.jpg")
      return {
        bytes: await readFile(
          join(process.cwd(), "demo", "school-gate-staged.jpg"),
        ),
        mime: "image/jpeg",
      };
    safePath(path);
    if (config()) {
      const res = await request(
        "/storage/v1/object/authenticated/report-photos/" + path,
      );
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        mime: res.headers.get("Content-Type") ?? "application/octet-stream",
      };
    }
    return local((db) => {
      const row = db
        .prepare("SELECT bytes,mime FROM photos WHERE path=?")
        .get(path);
      return row
        ? { bytes: row.bytes as Uint8Array, mime: String(row.mime) }
        : null;
    });
  },
  async deletePhoto(path: string): Promise<void> {
    safePath(path);
    if (config()) {
      await request("/storage/v1/object/report-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
      return;
    }
    local((db) => db.prepare("DELETE FROM photos WHERE path=?").run(path));
  },
};
