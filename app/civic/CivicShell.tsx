import Link from "next/link";
import { Droplet, MapPin, Waves } from "lucide-react";
import type { ReactNode } from "react";
import "./civic.css";

export function CivicShell({
  children,
  privateView = false,
}: {
  children: ReactNode;
  privateView?: boolean;
}) {
  return (
    <div className="cv-shell">
      <header className="cv-topbar">
        <Link
          href="/dashboard"
          className="cv-brand"
          aria-label="LeakLedger public dashboard"
        >
          <span className="logo">
            <Droplet fill="currentColor" size={34} />
            <Waves size={20} className="waves" />
          </span>{" "}
          LeakLedger
        </Link>
        {!privateView && (
          <nav aria-label="Ward navigation">
            <Link href="/report">Report an issue</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/">Officer desk</Link>
          </nav>
        )}
      </header>
      <main className={privateView ? "cv-main cv-narrow" : "cv-main"}>
        {children}
      </main>
      {!privateView && (
        <div className="cv-end">
          <MapPin size={15} />
          Ward 12 · Jayanagar, Bengaluru · Demo ward
        </div>
      )}
    </div>
  );
}

export const statusLabels: Record<string, string> = {
  awaiting_review: "Awaiting review",
  assigned: "Assigned",
  under_repair: "Under repair",
  repaired: "Repaired",
};
