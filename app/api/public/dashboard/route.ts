import { endpoint, json } from "../../../../lib/server/http.ts";
import { repo } from "../../../../lib/server/repository.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return endpoint(async () => json(await repo.dashboard()));
}
