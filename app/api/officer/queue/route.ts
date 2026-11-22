import { endpoint, json } from "../../../../lib/server/http.ts";
import { requireOfficer } from "../../../../lib/server/auth.ts";
import { repo } from "../../../../lib/server/repository.ts";
import { modelMode } from "../../../../lib/ai/model.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return endpoint(async () => {
    requireOfficer(request);
    return json({
      ...(await repo.snapshot()),
      model_mode: modelMode(),
      storage_mode: repo.mode,
    });
  });
}
