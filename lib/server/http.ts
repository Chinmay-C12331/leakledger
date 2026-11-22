export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

export async function endpoint(action: () => Response | Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    const status =
      typeof error === "object" && error && "status" in error
        ? error.status
        : null;
    if (status === 404) return json({ error: "Record not found." }, 404);
    if (status === 409)
      return json(
        {
          error:
            "This report or incident has changed. Refresh before continuing.",
        },
        409,
      );
    if (status === 400) return json({ error: "The update is invalid." }, 400);
    return json(
      { error: "The request could not be completed. Please try again." },
      500,
    );
  }
}

export function checkOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const denied = () => new HttpError(403, "Cross-site request denied.");
  if (site && site !== "same-origin" && site !== "none") throw denied();
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const url = new URL(request.url);
  // Next can reconstruct request.url with its internal listening hostname.
  // Browsers send the destination authority in Host, separate from Origin.
  const host = request.headers.get("host") ?? url.host;
  if (!/^(?:[a-z\d.-]+|\[[\da-f:]+\])(?::\d{1,5})?$/i.test(host)) throw denied();
  const protocol = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview"
    ? "https:" : url.protocol;
  let expected: string;
  try { expected = new URL(protocol + "//" + host).origin; }
  catch { throw denied(); }
  if (origin !== expected) throw denied();
}

export async function readBody(
  request: Request,
  limit: number,
): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "Upload exceeds the size limit.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body required.");
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new HttpError(413, "Upload exceeds the size limit.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts, total);
}

export async function objectBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new HttpError(415, "JSON content type required.");
  const bytes = await readBody(request, 8192);
  try {
    const obj = JSON.parse(bytes.toString("utf8"));
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  } catch {}
  throw new HttpError(400, "Invalid JSON object.");
}

export function uuid(id: unknown): string {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new HttpError(400, "Invalid record identifier.");
  }
  return id;
}
