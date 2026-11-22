import {
  endpoint,
  json,
  objectBody,
  HttpError,
  uuid,
} from "../../../../../../lib/server/http.ts";
import { requireOfficer } from "../../../../../../lib/server/auth.ts";
import { repo } from "../../../../../../lib/server/repository.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    requireOfficer(request);
    const { decision, candidate_incident_id } = await objectBody(request);
    if (
      decision !== "linked" &&
      decision !== "separate" &&
      decision !== "pending"
    )
      throw new HttpError(400, "Invalid decision.");
    const incident =
      decision === "linked" || candidate_incident_id != null
        ? uuid(candidate_incident_id)
        : undefined;
    await repo.decide(uuid((await params).id), decision, incident);
    return json({ ok: true });
  });
}
