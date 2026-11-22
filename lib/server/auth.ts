import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { checkOrigin, HttpError } from "./http.ts";

const cookieName = "leakledger_officer";
const lifetime = 8 * 60 * 60;
export function demoLoginAvailable() {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.SUPABASE_URL &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.OFFICER_PASSWORD &&
    !process.env.OFFICER_SESSION_SECRET
  );
}
function credentials() {
  if (demoLoginAvailable()) {
    // Next's dev server reloads modules. Keep the ephemeral key for this process.
    const globals = globalThis as typeof globalThis & {
      __leakledgerDevSecret?: string;
    };
    globals.__leakledgerDevSecret ??= randomBytes(32).toString("hex");
    return { password: "ward-demo", secret: globals.__leakledgerDevSecret };
  }
  const password = process.env.OFFICER_PASSWORD,
    secret = process.env.OFFICER_SESSION_SECRET;
  return password && secret && Buffer.byteLength(secret) >= 32
    ? { password, secret }
    : null;
}
function matches(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update("leakledger-officer:" + payload)
    .digest("base64url");
}
function cookie(value: string, maxAge: number, request: Request) {
  const secure =
    process.env.NODE_ENV === "production" ||
    new URL(request.url).protocol === "https:";
  return (
    cookieName +
    "=" +
    value +
    "; HttpOnly; SameSite=Strict; Path=/api/officer; Max-Age=" +
    maxAge +
    (secure ? "; Secure" : "")
  );
}
export function login(request: Request, password: unknown) {
  const config = credentials();
  if (!config) throw new HttpError(503, "Officer sign-in is not configured.");
  if (typeof password !== "string" || !matches(password, config.password))
    throw new HttpError(401, "Invalid officer password.");
  const payload =
    Math.floor(Date.now() / 1000 + lifetime) +
    "." +
    randomBytes(16).toString("hex");
  return cookie(
    payload + "." + signature(payload, config.secret),
    lifetime,
    request,
  );
}
export function logout(request: Request) {
  return cookie("", 0, request);
}
export function requireOfficer(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  const [exp, nonce, mac, ...extra] = (value ?? "").split(".");
  const config = credentials();
  if (
    !config ||
    extra.length ||
    !/^\d{10}$/.test(exp) ||
    Number(exp) <= Date.now() / 1000 ||
    !/^[a-f0-9]{32}$/.test(nonce ?? "") ||
    !mac ||
    !matches(mac, signature(exp + "." + nonce, config.secret))
  )
    throw new HttpError(401, "Officer sign-in required.");
  if (request.method !== "GET" && request.method !== "HEAD")
    checkOrigin(request);
}
