import test from "node:test";
import assert from "node:assert/strict";
import {
  createIncident,
  initialState,
  linkReport,
  setStatus,
} from "./ledger.ts";

function statusForReport(state, reportId) {
  const { incidentId } = state.reports.find((item) => item.id === reportId);
  return (
    state.incidents.find((item) => item.id === incidentId)?.status ??
    "Pending review"
  );
}

test("both school gate reports share the repair while the tea stall stays open", () => {
  const start = initialState();
  const linked = linkReport(start, "LL-1043", "INC-021");
  const repairing = setStatus(linked, "INC-021", "Under repair");
  const repaired = setStatus(repairing, "INC-021", "Repaired");
  assert.equal(statusForReport(repairing, "LL-1043"), "Under repair");
  assert.equal(statusForReport(repaired, "LL-1043"), "Repaired");
  assert.equal(statusForReport(repaired, "LL-1042"), "Repaired");
  assert.equal(statusForReport(repaired, "LL-1041"), "Open");
  assert.deepEqual(start, initialState());
});

test("creating a separate incident keeps all three reports independent", () => {
  const state = createIncident(initialState(), "LL-1043");
  const id = state.reports.find((item) => item.id === "LL-1043").incidentId;
  assert.equal(id, "INC-022");
  const repaired = setStatus(state, id, "Repaired");
  assert.equal(statusForReport(repaired, "LL-1043"), "Repaired");
  assert.equal(statusForReport(repaired, "LL-1042"), "Open");
  assert.equal(statusForReport(repaired, "LL-1041"), "Open");
  assert.equal(createIncident(repaired, "LL-1043"), repaired);
});

test("retries are idempotent, even after repairing an already linked incident", () => {
  const state = linkReport(initialState(), "LL-1043", "INC-021");
  assert.equal(linkReport(state, "LL-1043", "INC-021"), state);
  const repaired = setStatus(state, "INC-021", "Repaired");
  assert.equal(linkReport(repaired, "LL-1043", "INC-021"), repaired);
  assert.equal(setStatus(repaired, "INC-021", "Repaired"), repaired);
});

test("rejects links to repaired incidents and attempts to overwrite an existing link", () => {
  const repaired = setStatus(initialState(), "INC-021", "Repaired");
  assert.throws(() => linkReport(repaired, "LL-1043", "INC-021"), /repaired/);
  assert.throws(
    () => linkReport(repaired, "LL-1042", "INC-020"),
    /another incident/,
  );
  assert.equal(statusForReport(repaired, "LL-1043"), "Pending review");
});

test("unknown targets and invalid statuses fail without altering the input", () => {
  const state = initialState();
  assert.throws(() => createIncident(state, "missing"), /Report not found/);
  assert.throws(
    () => linkReport(state, "LL-1043", "missing"),
    /Incident not found/,
  );
  assert.throws(
    () => setStatus(state, "missing", "Open"),
    /Incident not found/,
  );
  assert.throws(
    () => setStatus(state, "INC-020", "Unknown"),
    /Invalid repair status/,
  );
  assert.deepEqual(state, initialState());
});
