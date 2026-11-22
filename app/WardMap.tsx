"use client";

import { useState } from "react";
import {
  Check,
  Droplet,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { Snapshot } from "../lib/server/types";
import "./map.css";

const locations: Record<string, { left: string; top: string }> = {
  "LL-1043": { left: "56.8%", top: "39%" },
  "LL-1042": { left: "52.7%", top: "49%" },
  "LL-1041": { left: "74.8%", top: "26%" },
};

export default function WardMap({
  state,
  onSelect,
}: {
  state: Snapshot;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState("LL-1043");
  const hasRepaired = state.incidents.some(
    (incident) => incident.repair_status === "repaired",
  );
  const ExpandIcon = expanded ? Minimize2 : Maximize2;

  return (
    <section
      className={`ward-map${expanded ? " ward-map--expanded" : ""}`}
      aria-label="Ward incident map"
    >
      <div className="ward-map__surface">
        <svg
          className="ward-map__streets"
          viewBox="0 0 1200 270"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <image href="/ward-map.svg" width="1200" height="270" />
        </svg>
        {state.reports.map((report) => {
          const position = locations[report.display_id];
          if (!position) return null;
          const repaired =
            state.incidents.find(
              (incident) => incident.id === report.incident_id,
            )?.repair_status === "repaired";
          const kind = repaired
            ? "repaired"
            : report.incident_id
              ? "linked"
              : "pending";
          const active = selected === report.display_id;
          const MarkerIcon = repaired ? Check : Droplet;
          return (
            <button
              key={report.id}
              type="button"
              style={position}
              onClick={() => {
                setSelected(report.display_id);
                onSelect(report.id);
              }}
              className={`ward-map__marker ward-map__marker--${kind}${active ? " ward-map__marker--selected" : ""}`}
              aria-label={`Review ${report.display_id}, ${report.landmark}, ${kind}`}
              title={`${report.display_id} · ${report.landmark}`}
            >
              <span className="ward-map__dot">
                <MarkerIcon size={13} strokeWidth={2.4} aria-hidden="true" />
              </span>
              {active && (
                <span className="ward-map__marker-label">
                  {report.display_id}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ward-map__chip">
        <Layers size={13} aria-hidden="true" />
        WARD 12
      </div>
      <button
        className="ward-map__expand"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <ExpandIcon size={14} aria-hidden="true" />
        {expanded ? "Collapse" : "Expand"}
      </button>
      <div className="ward-map__caption">
        <h2>Demo ward map</h2>
        <p>
          <MapPin size={14} aria-hidden="true" />
          Seeded landmarks · Jayanagar
        </p>
      </div>
      <div className="ward-map__legend" aria-label="Map key">
        <span>
          <i className="ward-map__key-pending" />
          Pending
        </span>
        <span>
          <i className="ward-map__key-linked" />
          Linked
        </span>
        {hasRepaired && (
          <span>
            <i className="ward-map__key-repaired" />
            Repaired
          </span>
        )}
      </div>
    </section>
  );
}
