import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareReports,
  findCandidates,
  distanceMeters,
  mockClient,
  routeAuthority,
} from "./model.ts";

const hi = {
  description: "स्कूल के नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।",
  landmark: "Blue school gate",
  language: "hi",
};
const en = {
  description: "A pipe joint is leaking at the blue school gate.",
  landmark: "Blue school gate",
  language: "en",
};
test("invalid JSON is retried once and a valid second completion is accepted", async () => {
  const seen = [];
  const result = await compareReports(hi, en, {
    async generate(a, b, retry) {
      seen.push(retry);
      return retry ? mockClient.generate(a, b, retry) : "not JSON";
    },
  });
  assert.deepEqual(seen, [false, true]);
  assert.equal(result.verdict, "likely_same");
});
test("malformed schema and invented photo evidence are rejected after one retry", async () => {
  const base = JSON.parse(await mockClient.generate(hi, en, false));
  for (const bad of [
    { ...base, verdict: "yes" },
    { ...base, supporting: [{ detail: "Gate in photo", source: "photo" }] },
    { ...base, extra: true },
  ]) {
    let calls = 0;
    await assert.rejects(
      compareReports(hi, en, {
        async generate() {
          calls++;
          return JSON.stringify(bad);
        },
      }),
      /invalid comparison/,
    );
    assert.equal(calls, 2);
  }
});
test("transport errors are not retried as JSON errors", async () => {
  let calls = 0;
  await assert.rejects(
    compareReports(hi, en, {
      async generate() {
        calls++;
        throw new Error("timeout");
      },
    }),
    /timeout/,
  );
  assert.equal(calls, 1);
});
test("zero candidates permits report-only triage without photo", async () => {
  const result = await compareReports(hi, null, mockClient);
  assert.equal(result.verdict, "uncertain");
  assert.deepEqual(result.supporting, []);
  assert.equal(routeAuthority(result.category), "Water Supply Dept.");
});
test("radius excludes distant and repaired incidents and sorts nearby open incidents", () => {
  const pos = { lat: 12.926, lng: 77.593 };
  const make = (id, offset, status = "assigned") => ({
    ...pos,
    lat: pos.lat + offset,
    id,
    repair_status: status,
  });
  const incidents = [
    make("inside", 0.001),
    make("far", 0.002),
    make("fixed", 0, "repaired"),
    make("near", 0.0001, "under_repair"),
  ];
  assert.ok(distanceMeters(pos, incidents[0]) > 110);
  assert.deepEqual(
    findCandidates(pos, incidents, 150).map((i) => i.id),
    ["near", "inside"],
  );
});
test("a shared location alone leaves the mock verdict uncertain", async () => {
  const vague = { ...hi, description: "पानी है।" };
  const result = await compareReports(vague, en, mockClient);
  assert.equal(result.verdict, "uncertain");
});
