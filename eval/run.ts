import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  compareReports,
  createLiveClient,
  mockClient,
  type ModelClient,
  type ModelReport,
  type ModelVerdict,
} from "../lib/ai/model.ts";

type Pair = {
  id: string;
  split: "dev" | "heldout";
  label: "same" | "different" | "insufficient";
  incoming: ModelReport;
  candidate: ModelReport;
};
type Row = {
  id: string;
  label: Pair["label"];
  verdict: ModelVerdict | "error";
};
const pairs: Pair[] = JSON.parse(
  await readFile(new URL("./pairs.json", import.meta.url), "utf8"),
);
const heldout = pairs.filter((p) => p.split === "heldout");

async function evaluate(client: ModelClient) {
  const rows: Row[] = [];
  for (const pair of heldout) {
    try {
      const result = await compareReports(
        pair.incoming,
        pair.candidate,
        client,
      );
      rows.push({ id: pair.id, label: pair.label, verdict: result.verdict });
    } catch {
      // Provider messages may contain request content. Persist only a stable outcome.
      rows.push({ id: pair.id, label: pair.label, verdict: "error" });
    }
  }
  return {
    status: rows.some((r) => r.verdict === "error") ? "partial" : "complete",
    counts: {
      attempted: rows.length,
      completed: rows.filter((r) => r.verdict !== "error").length,
      true_duplicates_suggested: rows.filter(
        (r) => r.label === "same" && r.verdict === "likely_same",
      ).length,
      separate_leaks_wrongly_suggested: rows.filter(
        (r) => r.label === "different" && r.verdict === "likely_same",
      ).length,
      uncertain: rows.filter((r) => r.verdict === "uncertain").length,
      errors: rows.filter((r) => r.verdict === "error").length,
    },
    rows,
  };
}
const live = process.env.OPENAI_API_KEY
  ? await evaluate(createLiveClient())
  : {
      status: "blocked",
      reason: "OPENAI_API_KEY is missing.",
      counts: null,
      rows: [],
    };
const offline = await evaluate(mockClient);
const resultFile = fileURLToPath(new URL("./results.json", import.meta.url));
const tmp = resultFile + "." + process.pid + ".tmp";
await writeFile(
  tmp,
  JSON.stringify(
    {
      dataset: "12 staged text-only pairs",
      split: "heldout",
      n: heldout.length,
      generated_at: new Date().toISOString(),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      live,
      offline_mock: offline,
    },
    null,
    2,
  ) + "\n",
);
await rename(tmp, resultFile);
console.log("Live model:", live.status);
if (live.counts) {
  console.table(live.rows);
  console.table([live.counts]);
} else {
  console.log("OPENAI_API_KEY is missing; live counts unavailable.");
}
console.log("Deterministic offline mock (separate run):");
console.table(offline.rows);
console.table([offline.counts]);
if (live.status === "partial") process.exitCode = 1;
