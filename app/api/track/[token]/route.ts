import { endpoint, json, HttpError } from "../../../../lib/server/http.ts";
import { repo } from "../../../../lib/server/repository.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return endpoint(async () => {
    const result = await repo.track((await params).token);
    if (!result) throw new HttpError(404, "Tracking link not found.");
    return json(result);
  });
}
