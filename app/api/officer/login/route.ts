import {
  endpoint,
  json,
  objectBody,
  checkOrigin,
} from "../../../../lib/server/http.ts";
import { login, demoLoginAvailable } from "../../../../lib/server/auth.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return json({ demo_login: demoLoginAvailable() });
}
export function POST(request: Request) {
  return endpoint(async () => {
    checkOrigin(request);
    const { password } = await objectBody(request);
    return json({ ok: true }, 200, { "Set-Cookie": login(request, password) });
  });
}
