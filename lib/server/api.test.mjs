import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { repo } from "./repository.ts";
import { saveSubmission, analyzeReport } from "./submission.ts";
import { POST as login } from "../../app/api/officer/login/route.ts";
import { GET as queue } from "../../app/api/officer/queue/route.ts";
import { GET as photo } from "../../app/api/officer/photos/[id]/route.ts";
import { POST as decide } from "../../app/api/officer/reviews/[id]/decision/route.ts";
import { POST as repair } from "../../app/api/officer/incidents/[id]/repair/route.ts";
import { GET as track } from "../../app/api/track/[token]/route.ts";
import { GET as dashboard } from "../../app/api/public/dashboard/route.ts";

const origin = "http://localhost:3000";
let dir, cookie;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENAI_API_KEY;
process.env.OFFICER_PASSWORD = randomBytes(20).toString("hex");
process.env.OFFICER_SESSION_SECRET = randomBytes(32).toString("hex");
function request(payload, idCookie, extra = {}) {
  const headers = new Headers(extra);
  if (idCookie) headers.set("cookie", idCookie);
  if (payload !== undefined) headers.set("content-type", "application/json");
  return new Request(origin, {
    method: payload === undefined ? "GET" : "POST",
    headers,
    body: payload === undefined ? null : JSON.stringify(payload),
  });
}
function param(id) {
  return { params: Promise.resolve({ id }) };
}
function tracking(token) {
  return track(request(), { params: Promise.resolve({ token }) });
}
function submission(file) {
  const f = new FormData();
  Object.entries({
    description: "नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।",
    landmark: "Blue school gate",
    language: "hi",
    lat: "12.92904",
    lng: "77.58203",
  }).forEach(([k, v]) => f.set(k, v));
  if (file) f.set("photo", file);
  return new Request(origin, { method: "POST", body: f });
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "leakledger-api-test-"));
  process.env.LEAKLEDGER_DATA_DIR = dir;
  const response = await login(
    request({ password: process.env.OFFICER_PASSWORD }),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  cookie = response.headers.get("Set-Cookie").split(";")[0];
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("officer reads, writes and private photos require authentication, even with a resident token", async () => {
  const { reports, incidents } = await repo.snapshot();
  const stolen = "leakledger_officer=" + reports[0].tracking_token;
  assert.equal((await queue(request())).status, 401);
  assert.equal((await queue(request(undefined, stolen))).status, 401);
  assert.equal((await photo(request(), param(reports[0].id))).status, 401);
  assert.equal(
    (await decide(request({ decision: "linked" }), param(reports[0].id)))
      .status,
    401,
  );
  assert.equal(
    (await repair(request({ status: "repaired" }), param(incidents[0].id)))
      .status,
    401,
  );
  assert.equal((await login(request({ password: "wrong" }))).status, 401);
  assert.equal(
    (
      await decide(
        request({ decision: "separate" }, cookie, {
          origin: "https://cross-site.example",
        }),
        param(reports[0].id),
      )
    ).status,
    403,
  );
  assert.equal((await queue(request(undefined, cookie))).status, 200);
});

test("same-origin browser requests survive Next hostname rewriting; mismatched origins and fetch metadata fail", async () => {
  const headers = {host: "127.0.0.1:3219", origin: "http://127.0.0.1:3219", "sec-fetch-site":"same-origin"};
  const signIn = (extra = {}) => login(request({password:process.env.OFFICER_PASSWORD}, undefined, {...headers,...extra}));
  assert.equal((await signIn()).status, 200);
  assert.equal((await signIn({origin:"http://unrelated.example"})).status, 403);
  assert.equal((await signIn({"sec-fetch-site":"same-site"})).status, 403);
  assert.equal((await signIn({host:"127.0.0.1:3219/path"})).status, 403);
});

test("duplicate confirms and reload create one link, and both tracking links follow one repair note", async () => {
  const { reports } = await repo.snapshot();
  const [incoming, source, other] = reports;
  const action = () =>
    decide(
      request(
        { decision: "linked", candidate_incident_id: source.incident_id },
        cookie,
      ),
      param(incoming.id),
    );
  const responses = await Promise.all([action(), action()]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.equal(
    (
      await repair(
        request(
          { status: "repaired", public_note: "Pipe joint replaced." },
          cookie,
        ),
        param(source.incident_id),
      )
    ).status,
    200,
  );
  const reloaded = await (await queue(request(undefined, cookie))).json();
  assert.equal(
    reloaded.reviews.filter(
      (r) => r.report_id === incoming.id && r.officer_decision === "linked",
    ).length,
    1,
  );
  for (const report of [incoming, source])
    assert.deepEqual(await (await tracking(report.tracking_token)).json(), {
      status: "repaired",
      public_note: "Pipe joint replaced.",
    });
  assert.deepEqual(await (await tracking(other.tracking_token)).json(), {
    status: "assigned",
    public_note: null,
  });
  assert.equal((await tracking(other.display_id)).status, 404);
  const dash = await (await dashboard()).json();
  assert.equal(dash.open, 1);
  assert.equal(dash.repaired, 1);
  for (const report of reports) {
    const body = JSON.stringify(dash);
    assert.ok(!body.includes(report.tracking_token));
    assert.ok(!body.includes(report.description));
  }
});

test("rejecting the candidate creates a separate incident and records the decision", async () => {
  const [r, s] = (await repo.snapshot()).reports;
  assert.equal(
    (
      await decide(
        request(
          { decision: "separate", candidate_incident_id: s.incident_id },
          cookie,
        ),
        param(r.id),
      )
    ).status,
    200,
  );
  const after = await repo.snapshot();
  assert.notEqual(after.reports[0].incident_id, s.incident_id);
  assert.equal(after.incidents.length, 3);
  assert.equal(
    after.reviews.find(
      (v) => v.report_id === r.id && v.candidate_incident_id === s.incident_id,
    ).officer_decision,
    "separate",
  );
});

test("missing photo and failed comparison preserve the submission and allow manual linking", async () => {
  const saved = await saveSubmission(submission());
  assert.equal(saved.photo_path, null);
  assert.equal((await tracking(saved.tracking_token)).status, 200);
  await analyzeReport(saved, async () => {
    throw new Error("test provider failure: private resident text");
  });
  const view = await repo.snapshot();
  const candidates = view.reviews.filter((r) => r.report_id === saved.id);
  assert.equal(candidates.length, 2);
  assert.ok(
    candidates.every(
      (r) => r.model_error === "AI unavailable, review manually",
    ),
  );
  assert.equal(
    (
      await decide(
        request(
          {
            decision: "linked",
            candidate_incident_id: candidates[0].candidate_incident_id,
          },
          cookie,
        ),
        param(saved.id),
      )
    ).status,
    200,
  );
});

test("photo content is decoded and stored privately, while false MIME claims and oversize photos fail", async () => {
  await assert.rejects(
    saveSubmission(
      submission(new File(["not an image"], "a.png", { type: "image/png" })),
    ),
    { status: 400 },
  );
  const tooBig = await sharp({
    create: { width: 1281, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    saveSubmission(
      submission(new File([tooBig], "big.png", { type: "image/png" })),
    ),
    { status: 400 },
  );
  const pixels = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const saved = await saveSubmission(
    submission(new File([pixels], "sample.png", { type: "image/png" })),
  );
  assert.ok(saved.photo_path);
  const response = await photo(request(undefined, cookie), param(saved.id));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal((await repo.snapshot()).reports.length, 4);
});
