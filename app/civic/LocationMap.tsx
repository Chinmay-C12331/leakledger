"use client";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export type Point = { lat: number; lng: number };
export type MapPin = Point & { id: string; repair_status: string };
export const schoolPoint = { lat: 12.929, lng: 77.582 };
const statusColors: Record<string, string> = {
  assigned: "#ca6e1c",
  under_repair: "#176ca4",
  repaired: "#148060",
  awaiting_review: "#776185",
};

export default function LocationMap({
  value,
  onPick,
  pins,
}: {
  value?: Point;
  onPick?: (p: Point) => void;
  pins?: MapPin[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const [library, setLibrary] = useState<typeof import("leaflet") | null>(null);
  const [tileError, setTileError] = useState(false);
  const initialFit = useRef(false);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    let disposed = false;
    import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        const instance = L.map(container.current, {
          scrollWheelZoom: false,
        }).setView([schoolPoint.lat, schoolPoint.lng], 17);
        map.current = instance;
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            // OSM requires a referrer; send only the origin, never page paths.
            referrerPolicy: "strict-origin-when-cross-origin",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(instance);
        tiles.on("tileerror", () => {
          if (!disposed) setTileError(true);
        });
        instance.on("click", (event) =>
          onPickRef.current?.({
            lat: +event.latlng.lat.toFixed(6),
            lng: +event.latlng.lng.toFixed(6),
          }),
        );
        markers.current = L.layerGroup().addTo(instance);
        setLibrary(L);
      })
      .catch(() => {
        if (!disposed) setTileError(true);
      });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);
  useEffect(() => {
    const layer = markers.current;
    if (!library || !layer || !map.current) return;
    layer.clearLayers();
    if (value) {
      library
        .circleMarker([value.lat, value.lng], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#087763",
          fillOpacity: 1,
        })
        .addTo(layer);
      map.current.panTo([value.lat, value.lng], { animate: false });
    }
    if (pins?.length) {
      for (const p of pins) {
        const color = statusColors[p.repair_status] ?? "#776185";
        const label = document.createElement("span");
        label.textContent = (
          p.repair_status[0].toUpperCase() + p.repair_status.slice(1)
        ).replaceAll("_", " ");
        library
          .circleMarker([p.lat, p.lng], {
            color: "#fff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
            radius: 8,
          })
          .bindTooltip(label)
          .addTo(layer);
      }
      if (!initialFit.current) {
        map.current.fitBounds(
          pins.map((p) => [p.lat, p.lng] as [number, number]),
          { padding: [40, 40], maxZoom: 18 },
        );
        initialFit.current = true;
      }
    }
  }, [library, value, pins]);
  return (
    <div className="cv-geomap">
      <div
        ref={container}
        className="cv-map"
        role="region"
        aria-label={
          onPick ? "Select a location on the map" : "Ward incident map"
        }
      />
      {tileError && (
        <p className="cv-tip">
          {onPick
            ? "Map tiles are unavailable. Choose a demo landmark below."
            : "Map tiles are unavailable. Status totals and recent fixes are listed on this page."}
        </p>
      )}
    </div>
  );
}
