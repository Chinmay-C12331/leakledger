import { endpoint, json } from "../../../../lib/server/http.ts";
import { requireOfficer, logout } from "../../../../lib/server/auth.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return endpoint(() => {
    requireOfficer(request);
    return json({ ok: true }, 200, { "Set-Cookie": logout(request) });
  });
}
