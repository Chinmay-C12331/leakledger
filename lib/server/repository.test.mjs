import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repo } from "./repository.ts";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const root = mkdtempSync(join(tmpdir(), "ll-repo-test-"));
after(() => rmSync(root, { recursive: true, force: true }));
function fresh() {
  process.env.LEAKLEDGER_DATA_DIR = mkdtempSync(join(root, "case-"));
}
test("shared incident update reaches each linked private token; tea stall stays separate", async () => {
  fresh();
  const s = await repo.snapshot(),
    [hi, school, tea] = s.reports;
  await Promise.all([
    repo.decide(hi.id, "linked", school.incident_id),
    repo.decide(hi.id, "linked", school.incident_id),
  ]);
  await repo.repair(school.incident_id, "repaired", "Pipe joint replaced.");
  await repo.repair(school.incident_id, "repaired", "Pipe joint replaced.");
  assert.deepEqual(await repo.track(hi.tracking_token), {
    status: "repaired",
    public_note: "Pipe joint replaced.",
  });
  assert.deepEqual(
    await repo.track(school.tracking_token),
    await repo.track(hi.tracking_token),
  );
  assert.deepEqual(await repo.track(tea.tracking_token), {
    status: "assigned",
    public_note: null,
  });
  assert.equal(await repo.track(tea.display_id), null);
  assert.equal(await repo.track("0".repeat(64)), null);
  const after = await repo.snapshot();
  assert.equal(after.incidents.length, 2);
  assert.equal(after.updates.length, 1);
  assert.equal(
    after.reviews.filter((r) => r.officer_decision === "linked").length,
    1,
  );
  const dashboard = await repo.dashboard();
  assert.deepEqual([dashboard.open, dashboard.repaired], [1, 1]);
  assert.deepEqual(Object.keys(dashboard.fixes[0]).sort(), [
    "created_at",
    "public_note",
    "status",
  ]);
  for (const incident of dashboard.incidents)
    assert.deepEqual(Object.keys(incident).sort(), [
      "id",
      "lat",
      "lng",
      "repair_status",
    ]);
});
test("separate creates one new incident and records the rejected candidates, even under retry", async () => {
  fresh();
  const [hi, school] = (await repo.snapshot()).reports;
  await repo.decide(hi.id, "separate", school.incident_id);
  await repo.decide(hi.id, "separate", school.incident_id);
  const s = await repo.snapshot();
  assert.notEqual(s.reports[0].incident_id, school.incident_id);
  assert.equal(s.incidents.length, 3);
  assert.ok(s.reviews.every((v) => v.officer_decision === "separate"));
  await assert.rejects(repo.decide(hi.id, "linked", school.incident_id));
});
test("late analysis preserves manual decisions; failed model output still permits review", async () => {
  fresh();
  const school = (await repo.snapshot()).reports[1];
  const r = await repo.createReport({
    description: "पाइप लीक है।",
    language: "hi",
    landmark: "School",
    lat: 12.929,
    lng: 77.582,
  });
  const analysis = {
    candidate_incident_id: school.incident_id,
    model_error: "AI unavailable",
    summary_en: "",
    verdict: "uncertain",
    supporting: [],
    conflicting: [],
  };
  await repo.decide(r.id, "linked", school.incident_id);
  await repo.saveAnalysis(
    r.id,
    { category: "other", severity: null, severity_reason: null },
    [analysis],
  );
  const s = await repo.snapshot(),
    stored = s.reviews.filter((v) => v.report_id === r.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].officer_decision, "linked");
  assert.equal(stored[0].model_error, "AI unavailable");
  assert.equal(r.photo_path, null);
  assert.match(r.tracking_token, /^[0-9a-f]{64}$/);
});
test("fallback photo bytes persist and private reads reject unrelated paths", async () => {
  fresh();
  const path = await repo.uploadPhoto(Uint8Array.from([1, 2, 3]), "image/png");
  const photo = await repo.readPhoto(path);
  assert.deepEqual([...photo.bytes], [1, 2, 3]);
  await assert.rejects(repo.readPhoto("../other"));
  await repo.deletePhoto(path);
  assert.equal(await repo.readPhoto(path), null);
});
