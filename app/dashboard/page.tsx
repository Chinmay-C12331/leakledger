"use client";
import { CircleCheck, MapPin, Wrench } from "lucide-react";
import { CivicShell, statusLabels } from "../civic/CivicShell";
import LocationMap, { type MapPin as IncidentPin } from "../civic/LocationMap";
import { useWardData } from "../civic/useWardData";

interface Dashboard {
  open: number;
  repaired: number;
  incidents: IncidentPin[];
  fixes: { status: string; public_note: string; created_at: string }[];
}
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
export default function DashboardPage() {
  const { data, error, retry } = useWardData<Dashboard>(
    "/api/public/dashboard",
  );
  const statuses = Array.from(
    new Set(data?.incidents.map((p) => p.repair_status)),
  );
  return (
    <CivicShell>
      <div className="cv-intro">
        <h1>Public dashboard</h1>
        <p>Open incidents and recent repairs in Ward 12, Jayanagar.</p>
      </div>
      {data ? (
        <>
          <section aria-label="Ward totals" className="cv-totals">
            <article className="cv-panel">
              <span className="cv-icon">
                <Wrench size={22} />
              </span>
              <div>
                <h2>Open incidents</h2>
                <strong>{data.open}</strong>
              </div>
            </article>
            <article className="cv-panel">
              <span className="cv-icon cv-resolved">
                <CircleCheck size={22} />
              </span>
              <div>
                <h2>Repaired incidents</h2>
                <strong>{data.repaired}</strong>
              </div>
            </article>
          </section>
          <section className="cv-panel cv-publicmap">
            <div className="cv-maphead">
              <h2>
                <MapPin size={19} />
                Incident map
              </h2>
              <div className="cv-legend">
                {statuses.map((s) => (
                  <span className={"cv-key cv-" + s} key={s}>
                    {statusLabels[s]}
                  </span>
                ))}
              </div>
            </div>
            <LocationMap pins={data.incidents} />
          </section>
          <section className="cv-panel cv-fixes">
            <h2>Recent fixes</h2>
            {data.fixes.length ? (
              <ul>
                {data.fixes.map((fix, i) => (
                  <li key={fix.created_at + i}>
                    <CircleCheck size={19} />
                    <div>
                      <p>{fix.public_note || "Repair completed."}</p>
                      <time dateTime={fix.created_at}>
                        {dateFormat.format(new Date(fix.created_at))} IST
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cv-tip">
                Completed repairs will appear here with the officer’s public
                update.
              </p>
            )}
          </section>
        </>
      ) : error ? (
        <div className="cv-panel">
          <p role="alert" className="cv-error">
            {error}
          </p>
          <button className="cv-plain" onClick={retry}>
            Try again
          </button>
        </div>
      ) : (
        <p role="status">Loading ward updates…</p>
      )}
    </CivicShell>
  );
}
