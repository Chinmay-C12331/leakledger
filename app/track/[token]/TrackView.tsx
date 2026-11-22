"use client";
import { Activity } from "lucide-react";
import { CivicShell, statusLabels } from "../../civic/CivicShell";
import { useWardData } from "../../civic/useWardData";

export default function TrackView({ token }: { token: string }) {
  const { data, error, retry } = useWardData<{
    status: string;
    public_note: string | null;
  }>("/api/track/" + encodeURIComponent(token));
  return (
    <CivicShell privateView>
      <article className="cv-panel cv-track">
        <div className="cv-icon">
          <Activity size={25} />
        </div>
        <h1>Repair status</h1>
        {data ? (
          <div aria-live="polite">
            <p className={"cv-status cv-" + data.status}>
              {statusLabels[data.status]}
            </p>
            {data.public_note && (
              <>
                <h2>Latest public update</h2>
                <p className="cv-note">{data.public_note}</p>
              </>
            )}
          </div>
        ) : error ? (
          <>
            <p role="alert" className="cv-error">
              {error}
            </p>
            <button className="cv-plain" onClick={retry}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Loading repair status…</p>
        )}
      </article>
    </CivicShell>
  );
}
