export type IncidentStatus = "Open" | "Under repair" | "Repaired";

export interface Report {
  id: string;
  title: string;
  description: string;
  landmark: string;
  language: "Hindi" | "English";
  reportedAt: string;
  incidentId: string | null;
}

export interface Incident {
  id: string;
  title: string;
  landmark: string;
  status: IncidentStatus;
}

export interface LedgerState {
  reports: Report[];
  incidents: Incident[];
}

export function initialState(): LedgerState {
  return {
    reports: [
      {
        id: "LL-1043",
        title: "Water leak outside school gate",
        description: "स्कूल के नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।",
        landmark: "Blue school gate",
        language: "Hindi",
        reportedAt: "2026-11-21T09:42:00+05:30",
        incidentId: null,
      },
      {
        id: "LL-1042",
        title: "Leaking pipe beside school entrance",
        description:
          "Water is flowing from the pipe joint just outside the blue school gate.",
        landmark: "Blue school gate",
        language: "English",
        reportedAt: "2026-11-21T09:16:00+05:30",
        incidentId: "INC-021",
      },
      {
        id: "LL-1041",
        title: "Water pooling near tea stall",
        description:
          "The pipe behind the tea stall is leaking into the lane beside the counter.",
        landmark: "Tea stall",
        language: "English",
        reportedAt: "2026-11-21T08:54:00+05:30",
        incidentId: "INC-020",
      },
    ],
    incidents: [
      {
        id: "INC-021",
        title: "School gate pipe leak",
        landmark: "Blue school gate",
        status: "Open",
      },
      {
        id: "INC-020",
        title: "Tea stall pipe leak",
        landmark: "Tea stall",
        status: "Open",
      },
    ],
  };
}

function findReport(state: LedgerState, reportId: string): Report {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) throw new Error("Report not found.");
  return report;
}

export function linkReport(
  state: LedgerState,
  reportId: string,
  incidentId: string,
): LedgerState {
  const report = findReport(state, reportId);
  const incident = state.incidents.find((item) => item.id === incidentId);
  if (!incident) throw new Error("Incident not found.");
  if (report.incidentId === incidentId) return state;
  if (report.incidentId)
    throw new Error("This report is already linked to another incident.");
  if (incident.status === "Repaired")
    throw new Error("This incident has already been repaired.");
  return {
    ...state,
    reports: state.reports.map((item) =>
      item.id === reportId ? { ...item, incidentId } : item,
    ),
  };
}

export function createIncident(
  state: LedgerState,
  reportId: string,
): LedgerState {
  const report = findReport(state, reportId);
  if (report.incidentId) return state;
  const highestNumber = state.incidents.reduce((highest, item) => {
    const match = /^INC-(\d+)$/.exec(item.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const incident: Incident = {
    id: "INC-" + String(highestNumber + 1).padStart(3, "0"),
    title: report.title,
    landmark: report.landmark,
    status: "Open",
  };
  return linkReport(
    { ...state, incidents: [incident, ...state.incidents] },
    reportId,
    incident.id,
  );
}

export function setStatus(
  state: LedgerState,
  incidentId: string,
  status: IncidentStatus,
): LedgerState {
  if (!["Open", "Under repair", "Repaired"].includes(status))
    throw new Error("Invalid repair status.");
  const incident = state.incidents.find((item) => item.id === incidentId);
  if (!incident) throw new Error("Incident not found.");
  if (incident.status === status) return state;
  return {
    ...state,
    incidents: state.incidents.map((item) =>
      item.id === incidentId ? { ...item, status } : item,
    ),
  };
}
