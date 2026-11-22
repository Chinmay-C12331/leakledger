import { repo } from "./repository.ts";
import type { Report, ReportInput, ReviewInput, Triage } from "./types.ts";
import {
  compareReports,
  findCandidates,
  type ModelReport,
} from "../ai/model.ts";
import { HttpError, readBody } from "./http.ts";
import { cleanPhoto, maxPhotoBytes } from "./photo.ts";

function field(form: FormData, name: string, max: number) {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(400, "Invalid " + name + ".");
  return value.trim();
}
function coordinate(form: FormData, name: string, limit: number) {
  const n = Number(field(form, name, 30));
  if (!Number.isFinite(n) || Math.abs(n) > limit)
    throw new HttpError(400, "Invalid location.");
  return n;
}
export async function saveSubmission(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;/i.test(contentType))
    throw new HttpError(415, "Submit as multipart form data.");
  const bytes = await readBody(request, maxPhotoBytes + 64 * 1024);
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new HttpError(400, "Invalid report form.");
  }
  const language = field(form, "language", 2);
  if (language !== "hi" && language !== "en")
    throw new HttpError(400, "Select Hindi or English.");
  const input: ReportInput = {
    description: field(form, "description", 3000),
    landmark: field(form, "landmark", 200),
    language,
    lat: coordinate(form, "lat", 90),
    lng: coordinate(form, "lng", 180),
  };
  const file = form.get("photo");
  if (file !== null && !(file instanceof File))
    throw new HttpError(400, "Invalid photo.");
  if (file instanceof File && (file.name || file.size)) {
    const photo = await cleanPhoto(file);
    input.photo_path = await repo.uploadPhoto(photo.bytes, photo.mime);
  }
  try {
    return await repo.createReport(input);
  } catch (error) {
    if (input.photo_path) await repo.deletePhoto(input.photo_path);
    throw error;
  }
}

async function modelInput(report: Report): Promise<ModelReport> {
  const { description, landmark, language } = report;
  const photo = report.photo_path
    ? await repo.readPhoto(report.photo_path)
    : null;
  const photo_url = photo
    ? "data:" +
      photo.mime +
      ";base64," +
      Buffer.from(photo.bytes).toString("base64")
    : null;
  return { description, landmark, language, photo_url };
}

// Submission is already durable before analysis starts. Officers may act while comparison runs.
export async function analyzeReport(
  report: Report,
  compare: typeof compareReports = compareReports,
) {
  const snapshot = await repo.snapshot();
  const candidates = findCandidates(report, snapshot.incidents);
  let triage: Triage = {
    category: "other",
    severity: null,
    severity_reason: "AI unavailable, review manually",
  };
  const reviews: ReviewInput[] = [];
  const source = await modelInput(report).catch(() => null);
  // Work in small batches so additional candidate photos are not all decoded at once.
  for (let start = 0; start < Math.max(candidates.length, 1); start += 3) {
    const batch = candidates.length
      ? candidates.slice(start, start + 3)
      : [null];
    const results = await Promise.all(
      batch.map(async (incident) => {
        try {
          if (!source) throw new Error("Photo unavailable");
          const rep = incident
            ? snapshot.reports.find(
                (r) => r.id === incident.representative_report_id,
              )
            : null;
          if (incident && !rep)
            throw new Error("Representative report unavailable");
          const output = await compare(
            source,
            rep ? await modelInput(rep) : null,
          );
          const {
            category,
            severity,
            severity_reason,
            summary_en,
            verdict,
            supporting,
            conflicting,
          } = output;
          return {
            triage: { category, severity, severity_reason },
            review: incident
              ? {
                  candidate_incident_id: incident.id,
                  summary_en,
                  verdict,
                  supporting,
                  conflicting,
                  model_error: null,
                }
              : null,
          };
        } catch {
          return {
            triage: null,
            review: incident
              ? {
                  candidate_incident_id: incident.id,
                  summary_en: "",
                  verdict: "uncertain" as const,
                  supporting: [],
                  conflicting: [],
                  model_error: "AI unavailable, review manually",
                }
              : null,
          };
        }
      }),
    );
    for (const result of results) {
      if (result.triage && triage.severity === null) triage = result.triage;
      if (result.review) reviews.push(result.review);
    }
  }
  await repo.saveAnalysis(report.id, triage, reviews);
}
