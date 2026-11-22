"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  GitMerge,
  ImageOff,
  Languages,
  Link2,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import type {
  Decision,
  Evidence,
  Report,
  RepairStatus,
} from "../lib/server/types";
import {
  categoryNames,
  sendOfficerAction,
  statusNames,
  type OfficerQueue,
} from "./officer-ui";
import "./detail.css";

type Props = {
  state: OfficerQueue;
  report: Report;
  onClose: () => void;
  onChange: () => Promise<void>;
};
const verdicts = {
  likely_same: "Likely same",
  uncertain: "Uncertain",
  likely_different: "Likely different",
};
const sourceTags = {
  text: "Resident’s words",
  photo: "Photo",
  landmark: "Landmark",
};
function ReportCard({ report, heading }: { report: Report; heading: string }) {
  const staged = ["LL-1041", "LL-1042", "LL-1043"].includes(report.display_id);
  return (
    <section className="ld-testimony">
      <div className="ld-testimony-label">
        {heading}
        <span>{report.display_id}</span>
      </div>
      <h4>{report.landmark}</h4>
      <blockquote lang={report.language}>{report.description}</blockquote>
      <p className="ld-language">
        {report.language === "hi" ? "Hindi" : "English"} ·{" "}
        {staged ? "Staged report" : "Original description"}
      </p>
      {report.photo_path ? (
        <img
          className="ld-photo"
          src={"/api/officer/photos/" + encodeURIComponent(report.id)}
          alt={"Submitted photo for " + report.display_id}
        />
      ) : (
        <div className="ld-photo-empty">
          <ImageOff size={15} />
          No photo submitted
        </div>
      )}
    </section>
  );
}
function EvidenceList({ label, items }: { label: string; items: Evidence[] }) {
  return (
    <section className="evidence-panel">
      <h4>{label}</h4>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              <span>{sourceTags[item.source]}</span>
              {item.detail}
            </li>
          ))}
        </ul>
      ) : (
        <p>No details cited.</p>
      )}
    </section>
  );
}
export default function Detail({ state, report, onClose, onChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const linked = state.incidents.find((i) => i.id === report.incident_id);
  const reviews = state.reviews.filter((r) => r.report_id === report.id);
  const rank = (id: string) => {
    const review = reviews.find((r) => r.candidate_incident_id === id);
    if (!review) return 4;
    return ["likely_same", "uncertain", "likely_different"].indexOf(
      review.verdict,
    );
  };
  const candidates = state.incidents
    .filter((i) => i.repair_status !== "repaired")
    .sort((a, b) => rank(a.id) - rank(b.id));
  const [choice, setChoice] = useState(candidates[0]?.id ?? "");
  const candidate =
    linked ?? candidates.find((i) => i.id === choice) ?? candidates[0];
  const review = reviews.find((r) => r.candidate_incident_id === candidate?.id);
  const representative = state.reports.find(
    (r) => r.id === candidate?.representative_report_id,
  );
  const linkedReports = linked
    ? state.reports.filter((r) => r.incident_id === linked.id)
    : [];
  const lastNote =
    linked &&
    state.updates
      .filter((u) => u.incident_id === linked.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const [newStatus, setNewStatus] = useState<RepairStatus | null>(null),
    [note, setNote] = useState("");
  const repairStatus = newStatus ?? linked?.repair_status ?? "assigned";
  useEffect(() => {
    const opener = document.activeElement;
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  async function submit(
    path: string,
    body: unknown,
    message: string,
    close = false,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await sendOfficerAction(path, body);
      await onChange();
      setNotice(message);
      if (close) onClose();
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save. Try again.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function decide(decision: Decision) {
    return submit(
      "/api/officer/reviews/" + report.id + "/decision",
      { decision, candidate_incident_id: candidate?.id },
      decision === "linked"
        ? "Report linked to the existing incident."
        : decision === "separate"
          ? "Separate incident created."
          : "Report left pending.",
      decision === "pending",
    );
  }
  return (
    <dialog
      className="ld-dialog"
      ref={dialog}
      aria-labelledby="ld-title"
      onClose={onClose}
    >
      <div className="ld-header">
        <span className="ld-heading-icon">
          <ClipboardList size={20} />
        </span>
        Report review
        <button
          className="ld-close"
          aria-label="Close report review"
          onClick={() => dialog.current?.close()}
        >
          <X size={19} />
        </button>
      </div>
      <div className="ld-body">
        <div className="ld-report-id">{report.display_id}</div>
        <h2 id="ld-title">{report.landmark}</h2>
        <div className="ld-tokens">
          <span>{categoryNames[report.category]}</span>
          <span>
            {report.severity
              ? report.severity + " severity"
              : "Severity pending"}
          </span>
          <span>Routed to: {report.routed_to}</span>
        </div>
        {report.severity_reason && (
          <p className="ld-empty">{report.severity_reason}</p>
        )}
        {!linked && (
          <>
            <h3>
              <GitMerge size={19} />
              Compare incidents
            </h3>
            {candidate ? (
              <>
                <label className="ld-field" htmlFor="ld-candidate">
                  Candidate incident
                </label>
                <div className="ld-select">
                  <select
                    id="ld-candidate"
                    value={candidate.id}
                    onChange={(e) => {
                      setChoice(e.target.value);
                      setNotice("");
                      setError("");
                    }}
                  >
                    {candidates.map((i) => {
                      const r = state.reports.find(
                        (r) => r.id === i.representative_report_id,
                      );
                      return (
                        <option key={i.id} value={i.id}>
                          {r?.landmark ?? "Ward incident"} · {r?.display_id} ·{" "}
                          {statusNames[i.repair_status]}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </>
            ) : (
              <p className="ld-empty">
                There are no open incidents. Create an incident for this report
                or leave it pending.
              </p>
            )}
          </>
        )}
        <div className="ld-comparison">
          <ReportCard report={report} heading="Resident report" />
          {representative && representative.id !== report.id && (
            <ReportCard
              report={representative}
              heading="Incident’s original report"
            />
          )}
        </div>
        {review && (
          <section className="ld-analysis">
            <h3>
              <Languages size={19} />
              Comparison evidence
              <span className="ld-mode">
                {report.display_id === "LL-1043"
                  ? "Staged example"
                  : state.model_mode === "demo"
                    ? "Offline demo"
                    : "Model assessment"}
              </span>
            </h3>
            {review.model_error ? (
              <p className="ld-failure">AI unavailable, review manually</p>
            ) : (
              <>
                <span className={"ld-verdict " + review.verdict}>
                  {verdicts[review.verdict]}
                </span>
                <div className="ld-summary">
                  <b>English summary</b>
                  <p>{review.summary_en}</p>
                </div>
                <div className="ld-evidence">
                  <EvidenceList label="Agreement" items={review.supporting} />
                  <EvidenceList label="Conflict" items={review.conflicting} />
                </div>
              </>
            )}
          </section>
        )}
        {!review && candidate && !linked && (
          <p className="ld-empty">
            {state.model_mode === "unavailable"
              ? "AI unavailable, review manually"
              : "No comparison available for this incident. Review the original reports manually."}
          </p>
        )}
        {!linked ? (
          <div className="ld-actions">
            {candidate && (
              <button
                disabled={busy}
                className="ld-primary"
                onClick={() => decide("linked")}
              >
                <Link2 size={17} />
                Confirm link
              </button>
            )}
            <button
              disabled={busy}
              className="ld-secondary"
              onClick={() => decide("separate")}
            >
              <Plus size={17} />
              Create separate incident
            </button>
            <button
              disabled={busy}
              className="ld-secondary"
              onClick={() => decide("pending")}
            >
              Leave pending
            </button>
          </div>
        ) : (
          <>
            <h3>
              <Link2 size={19} />
              Linked incident
            </h3>
            <p className="ld-empty">
              {linkedReports.length} linked{" "}
              {linkedReports.length === 1 ? "report" : "reports"} ·{" "}
              {statusNames[linked.repair_status]}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await submit(
                  "/api/officer/incidents/" + linked.id + "/repair",
                  { status: repairStatus, public_note: note.trim() },
                  "Repair update saved for all linked reports.",
                );
                if (ok) {
                  setNewStatus(null);
                  setNote("");
                }
              }}
            >
              <label className="ld-field" htmlFor="ld-status">
                Repair status
              </label>
              <div className="ld-select">
                <select
                  id="ld-status"
                  value={repairStatus}
                  onChange={(e) => setNewStatus(e.target.value as RepairStatus)}
                >
                  {(["assigned", "under_repair", "repaired"] as const).map(
                    (s) => (
                      <option key={s} value={s}>
                        {statusNames[s]}
                      </option>
                    ),
                  )}
                </select>
                <ChevronDown size={16} />
              </div>
              <label className="ld-field" htmlFor="ld-note">
                Public repair note
              </label>
              <textarea
                id="ld-note"
                rows={2}
                value={note}
                required
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What should residents know about this repair?"
              />
              <div className="ld-actions">
                <button className="ld-primary" disabled={busy || !note.trim()}>
                  <CheckCheck size={17} />
                  Save repair update
                </button>
              </div>
            </form>
            {lastNote && (
              <p className="ld-lastnote">
                <b>Latest public note</b> {lastNote.public_note}
              </p>
            )}
            <div className="ld-tracklinks">
              {linkedReports.map((r) => (
                <a
                  className="ld-track"
                  key={r.id}
                  href={"/track/" + encodeURIComponent(r.tracking_token)}
                >
                  <FileText size={15} />
                  Track {r.display_id}
                </a>
              ))}
            </div>
          </>
        )}
        <p className="ld-notice" role="status">
          {notice}
        </p>
        {error && (
          <p className="ld-failure" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
