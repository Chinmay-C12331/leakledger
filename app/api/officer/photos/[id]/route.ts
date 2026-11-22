import { endpoint, HttpError, uuid } from "../../../../../lib/server/http.ts";
import { requireOfficer } from "../../../../../lib/server/auth.ts";
import { repo } from "../../../../../lib/server/repository.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    requireOfficer(request);
    const id = uuid((await params).id);
    const report = (await repo.snapshot()).reports.find((r) => r.id === id);
    const photo = report?.photo_path
      ? await repo.readPhoto(report.photo_path)
      : null;
    if (!photo) throw new HttpError(404, "Photo not found.");
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
