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
    const { status, public_note } = await objectBody(request);
    if (
      status !== "assigned" &&
      status !== "under_repair" &&
      status !== "repaired"
    )
      throw new HttpError(400, "Invalid repair status.");
    if (
      typeof public_note !== "string" ||
      !public_note.trim() ||
      public_note.length > 600
    )
      throw new HttpError(
        400,
        "Enter a public repair note of up to 600 characters.",
      );
    await repo.repair(uuid((await params).id), status, public_note.trim());
    return json({ ok: true });
  });
}
