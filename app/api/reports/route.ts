import { endpoint, json, checkOrigin } from "../../../lib/server/http.ts";
import {
  saveSubmission,
  analyzeReport,
} from "../../../lib/server/submission.ts";
import { after } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export function POST(request: Request) {
  return endpoint(async () => {
    checkOrigin(request);
    const report = await saveSubmission(request);
    after(async () => {
      await analyzeReport(report).catch(() => {
        console.warn(
          "Report analysis could not be persisted; manual review remains available.",
        );
      });
    });
    return json(
      {
        display_id: report.display_id,
        tracking_token: report.tracking_token,
        tracking_url: "/track/" + report.tracking_token,
      },
      201,
    );
  });
}
