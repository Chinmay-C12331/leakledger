"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  LogOut,
  RefreshCw,
  Map,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Droplet,
  Droplets,
  Inbox,
  Layers3,
  LayoutDashboard,
  ListFilter,
  MapPin,
  Menu,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Waves,
  Wrench,
} from "lucide-react";
import type { Report } from "../lib/server/types";
import {
  categoryNames,
  sendOfficerAction,
  statusNames,
  type OfficerQueue,
} from "./officer-ui";
import "./officer.css";
import WardMap from "./WardMap";
import Detail from "./Detail";
type Tab = "Overview" | "Review queue" | "Incidents";
const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Review queue", icon: Inbox },
  { label: "Incidents", icon: Layers3 },
] as const;

const time = (date: string) =>
  new Date(date)
    .toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .toUpperCase();
function Brand() {
  return (
    <div className="brand">
      <span className="logo">
        <Droplet fill="currentColor" size={36} />
        <Waves size={21} className="waves" />
      </span>
      LeakLedger
    </div>
  );
}
function Pill({ value }: { value: string }) {
  return (
    <span
      className={
        "pill " +
        (value === "Needs review"
          ? "amber"
          : value === "Repaired"
            ? "green"
            : "blue")
      }
    >
      <i />
      {value}
    </span>
  );
}
export default function Page() {
  const [data, setData] = useState<OfficerQueue | null>(null),
    [tab, setTab] = useState<Tab>("Overview"),
    [selected, setSelectedState] = useState(""),
    [menu, setMenu] = useState(false),
    [filter, setFilter] = useState("All statuses"),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [demoLogin, setDemoLogin] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0);
  const setSelected = useCallback((id: string) => {
    setSelectedState(id);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname +
        (id ? "#review/" + encodeURIComponent(id) : ""),
    );
  }, []);
  useEffect(() => {
    const restore = () => {
      const id = /^#review\/([0-9a-f-]{36})$/i.exec(window.location.hash)?.[1];
      setSelectedState(id ?? "");
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      const response = await fetch("/api/officer/queue", { cache: "no-store" });
      if (request !== generation.current) return;
      if (response.status === 401) {
        setData(null);
        setSelected("");
        return;
      }
      if (!response.ok)
        throw new Error("The review queue could not be loaded.");
      const snapshot: OfficerQueue = await response.json();
      if (request === generation.current) {
        setData(snapshot);
        setError("");
      }
    } catch (failure) {
      if (request === generation.current)
        setError(
          failure instanceof Error ? failure.message : "Connection failed.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    fetch("/api/officer/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => setDemoLogin(v.demo_login === true))
      .catch(() => {});
    return () => {
      generation.current++;
    };
  }, [reload]);
  const signedIn = data !== null;
  useEffect(() => {
    if (!signedIn) return;
    function refresh() {
      if (document.visibilityState === "visible") void reload();
    }
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 12000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [reload, signedIn]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendOfficerAction("/api/officer/login", { password });
      setPassword("");
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await sendOfficerAction("/api/officer/logout");
      generation.current++;
      setData(null);
      setError("");
      setSelected("");
      setMenu(false);
      setTab("Overview");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="desk-entry">
        <div className="portal-bar">
          <Brand />
          <span>
            <MapPin size={16} />
            Jayanagar · Ward 12
          </span>
        </div>
        <div className="portal-body">
          <section className="portal-welcome">
            <div
              className="portal-map"
              role="img"
              aria-label="Schematic of the demo ward"
            >
              <span>
                <MapPin size={16} /> Ward 12
              </span>
            </div>
            <div className="portal-copy">
              <h1>Ward service desk</h1>
              <p>
                Report a leak in Jayanagar or see which incidents the ward has
                repaired.
              </p>
              <div className="portal-links">
                <a className="primary" href="/report">
                  <Droplet size={17} />
                  Report a problem
                </a>
                <a href="/dashboard">
                  <Map size={17} />
                  Public dashboard
                </a>
              </div>
            </div>
          </section>
          <section className="signin-card card">
            <span className="iconBox aqua">
              <ShieldCheck size={20} />
            </span>
            <h2>Officer sign-in</h2>
            <p>Review resident reports and update repairs.</p>
            <form onSubmit={login}>
              <label htmlFor="officer-password">Officer password</label>
              <input
                id="officer-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {demoLogin && (
                <small>
                  Local demo password: <code>ward-demo</code>
                </small>
              )}
              <button
                className="primary"
                type="submit"
                disabled={busy || loading}
              >
                {loading
                  ? "Checking session…"
                  : busy
                    ? "Signing in…"
                    : "Sign in"}
              </button>
              {error && (
                <p className="api-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </section>
        </div>
      </main>
    );
  function go(t: Tab) {
    setTab(t);
    setMenu(false);
    setFilter("All statuses");
    setQuery("");
    setSelected("");
    window.scrollTo(0, 0);
  }
  const pending = data.reports.filter((r) => !r.incident_id).length,
    open = data.incidents.filter((i) => i.repair_status !== "repaired").length,
    repaired = data.incidents.length - open;
  const stats = [
    {
      label: "Total reports",
      n: data.reports.length,
      icon: ClipboardList,
      tone: "aqua",
      note: "Resident submissions",
    },
    {
      label: "Awaiting review",
      n: pending,
      icon: Inbox,
      tone: "gold",
      note: "Pending officer decision",
    },
    {
      label: "Active incidents",
      n: open,
      icon: Droplets,
      tone: "sky",
      note: "Open or under repair",
    },
    {
      label: "Repaired",
      n: repaired,
      icon: CircleCheck,
      tone: "sage",
      note: "Resolved incidents",
    },
  ];
  const reportStatus = (r: Report) =>
    statusNames[
      data.incidents.find((i) => i.id === r.incident_id)?.repair_status ??
        "awaiting_review"
    ];
  const rows = data.reports.filter(
    (r) =>
      (tab !== "Review queue" || !r.incident_id) &&
      (filter === "All statuses" || reportStatus(r) === filter) &&
      [r.display_id, r.description, r.landmark, r.language]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const active = data.reports.find((r) => r.id === selected);
  return (
    <div className="shell">
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={"rail " + (menu ? "mobileOpen" : "")}>
        <Brand />
        <button
          className="mobileClose"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <PanelLeftClose />
        </button>
        <div className="railTitle">WORKSPACE</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => go(label)}
              className={tab === label ? "chosen" : ""}
              aria-current={tab === label ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {label === "Review queue" && (
                <span className="counter">{pending}</span>
              )}
            </button>
          ))}
          <a href="/report">
            <Droplet size={19} />
            Report a problem
          </a>
          <a href="/dashboard">
            <Map size={19} />
            Public dashboard
          </a>
        </nav>
        <div className="railFoot">
          <div className="wardBadge">
            <Building2 size={19} />
            <div>
              <strong>Ward 12</strong>
              <span>Jayanagar, Bengaluru</span>
            </div>
          </div>
          <div className="officer">
            <span className="avatar">WO</span>
            <div>
              <strong>Ward officer</strong>
              <span>
                {data.storage_mode === "local"
                  ? "Local demo"
                  : "Ward workspace"}
              </span>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              className="signout"
              disabled={busy}
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="surface">
        <header>
          <div className="crumb">
            <button
              className="hamburger"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <Building2 size={16} />
            Workspace <ChevronRight size={14} />
            <b>{tab}</b>
          </div>
          <span className="topward">
            <span className="pulse" />
            Ward 12
          </span>
        </header>
        <main className="main">
          <div className="headline">
            <div>
              <h1>{tab === "Overview" ? "Ward overview" : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "Monitor water leaks, review reports, and coordinate repairs."
                  : tab === "Review queue"
                    ? "Compare resident reports and decide which incidents they belong to."
                    : "Track repairs across reported water leaks in the ward."}
              </p>
            </div>
            {tab === "Overview" && (
              <button className="primary" onClick={() => go("Review queue")}>
                <Inbox size={17} />
                Review queue <span>{pending}</span>
              </button>
            )}
          </div>
          {error && (
            <p className="api-error" role="alert">
              {error}
            </p>
          )}
          {tab === "Overview" && (
            <>
              <WardMap state={data} onSelect={setSelected} />
              <div className="stats">
                {stats.map(({ label, n, icon: Icon, tone, note }) => (
                  <div className="stat card" key={label}>
                    <div className="statlabel">
                      <span className={"iconBox " + tone}>
                        <Icon size={18} />
                      </span>
                      {label}
                    </div>
                    <strong>{n.toString().padStart(2, "0")}</strong>
                    <span className="note">{note}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab !== "Incidents" ? (
            <section className="card list">
              <div className="sectionhead">
                <div>
                  <div className="withcount">
                    <h2>
                      {tab === "Overview"
                        ? "Recent reports"
                        : "Reports to review"}
                    </h2>
                    <span>
                      {tab === "Overview" ? data.reports.length : pending}
                    </span>
                  </div>
                  <p>
                    {tab === "Overview"
                      ? "Latest resident submissions across the ward."
                      : "Open a report to compare its evidence."}
                  </p>
                </div>
                <button
                  className="desk-refresh"
                  onClick={reload}
                  aria-label="Refresh reports"
                >
                  <RefreshCw size={16} />
                </button>
                {tab === "Overview" && (
                  <label className="select">
                    <ListFilter size={15} />
                    <select
                      aria-label="Filter reports by status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        "All statuses",
                        "Needs review",
                        "Assigned",
                        "Under repair",
                        "Repaired",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {tab === "Review queue" && (
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search pending reports"
                    placeholder="Search reports"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              )}
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Report details</th>
                      <th>Triage</th>
                      <th>Received · IST</th>
                      <th>Status</th>
                      <th aria-label="Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} onClick={() => setSelected(r.id)}>
                        <td>
                          <div className="reportname">
                            <span
                              className={
                                "rowIcon " + (!r.incident_id ? "warm" : "")
                              }
                            >
                              <Droplet size={20} />
                            </span>
                            <div>
                              <button
                                className="titlebtn"
                                onClick={() => setSelected(r.id)}
                              >
                                {r.landmark}
                              </button>
                              <div className="subline">
                                <span className="mono">{r.display_id}</span>
                                <i />
                                {r.language === "hi" ? "Hindi" : "English"}
                              </div>
                              <div className="mobile-triage">
                                {categoryNames[r.category]} ·{" "}
                                {r.severity
                                  ? r.severity + " severity"
                                  : "Assessment pending"}
                                <br />
                                Routed to: {r.routed_to}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="desk-triage">
                            <span
                              className={"desk-severity " + (r.severity ?? "")}
                            >
                              {r.severity
                                ? r.severity + " severity"
                                : "Awaiting assessment"}
                            </span>
                            <span>{categoryNames[r.category]}</span>
                          </div>
                          <div className="desk-route">
                            Routed to: {r.routed_to}
                          </div>
                        </td>
                        <td className="time">{time(r.submitted_at)}</td>
                        <td>
                          <Pill value={reportStatus(r)} />
                        </td>
                        <td>
                          <ChevronRight size={16} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <div className="empty">
                  <CheckCheck />{" "}
                  {pending === 0 && tab === "Review queue"
                    ? "All reports reviewed."
                    : "No matching reports."}
                </div>
              )}
            </section>
          ) : (
            <section className="card list">
              <div className="sectionhead">
                <div>
                  <h2>Incident register</h2>
                  <p>Select an incident to update its repair status.</p>
                </div>
              </div>
              {data.incidents.map((i) => (
                <button
                  className="incident"
                  key={i.id}
                  onClick={() =>
                    setSelected(
                      data.reports.find((r) => r.incident_id === i.id)?.id ??
                        "",
                    )
                  }
                >
                  <span className="iconBox aqua">
                    <Wrench size={18} />
                  </span>
                  <div>
                    <b>
                      {data.reports.find(
                        (r) => r.id === i.representative_report_id,
                      )?.landmark ?? "Ward incident"}
                    </b>
                    <div className="subline">
                      {
                        data.reports.filter((r) => r.incident_id === i.id)
                          .length
                      }{" "}
                      linked report(s)
                    </div>
                  </div>
                  <Pill value={statusNames[i.repair_status]} />
                  <ChevronRight size={17} />
                </button>
              ))}
            </section>
          )}
          <footer>
            <span>
              <ShieldCheck size={14} />
              Officer workspace
            </span>
            <span>
              <ShieldCheck size={14} />
              {data.model_mode === "demo"
                ? "Offline model demo"
                : data.model_mode === "live"
                  ? "Live model configured"
                  : "Manual review"}{" "}
              · Simulated routing
            </span>
          </footer>
        </main>
      </div>
      {active && (
        <Detail
          key={active.id}
          report={active}
          state={data}
          onClose={() => setSelected("")}
          onChange={reload}
        />
      )}
    </div>
  );
}
