"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  ClipboardCopy,
  MapPin,
  MessageSquareText,
  Send,
} from "lucide-react";
import { CivicShell } from "../civic/CivicShell";
import LocationMap, { schoolPoint, type Point } from "../civic/LocationMap";
import { preparePhoto } from "./photo";

const places = [
  { id: "school", name: "Blue school gate", ...schoolPoint },
  { id: "tea", name: "Tea stall", lat: 12.92949, lng: 77.58238 },
];
type Receipt = { display_id: string; tracking_url: string };

function receiptFromFragment(fragment: string): Receipt | undefined {
  const match = /^#received\/(LL-\d{4,16})\/([0-9a-f]{64})$/.exec(fragment);
  if (match)
    return { display_id: match[1], tracking_url: "/track/" + match[2] };
}

export default function ReportPage() {
  const [point, setPoint] = useState<Point>(),
    [place, setPlace] = useState(""),
    [landmark, setLandmark] = useState("");
  const [language, setLanguage] = useState("en"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt>(),
    [copied, setCopied] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const restore = () => setReceipt(receiptFromFragment(window.location.hash));
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!point) {
      setError("Place a pin or choose a demo landmark before submitting.");
      return;
    }
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      form.set("lat", String(point.lat));
      form.set("lng", String(point.lng));
      const file = form.get("photo");
      if (file instanceof File && file.size)
        form.set("photo", await preparePhoto(file));
      else form.delete("photo");
      const response = await fetch("/api/reports", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Report submission failed.");
      const fragment =
        "#received/" + result.display_id + "/" + result.tracking_token;
      const savedReceipt = receiptFromFragment(fragment);
      if (!savedReceipt)
        throw new Error(
          "The report was received but the tracking link could not be read.",
        );
      window.history.replaceState(window.history.state, "", fragment);
      setReceipt(savedReceipt);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit. Try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <CivicShell>
      {receipt ? (
        <article className="cv-panel cv-receipt">
          <CheckCircle2 size={38} className="cv-success-icon" />
          <h1>Report received</h1>
          <p>
            Reference <strong>{receipt.display_id}</strong>
          </p>
          <p>
            Save this private tracking link to see the ward officer’s updates.
          </p>
          <label className="cv-field">
            Private tracking link
            <input
              readOnly
              value={new URL(receipt.tracking_url, window.location.origin).href}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="cv-actions">
            <Link className="cv-button" href={receipt.tracking_url}>
              Track this report
            </Link>
            <button
              className="cv-plain"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    new URL(receipt.tracking_url, window.location.origin).href,
                  );
                  setCopied(true);
                } catch {
                  setError("Select and copy your tracking link above.");
                }
              }}
            >
              <ClipboardCopy size={16} />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          {error && <p role="status">{error}</p>}
        </article>
      ) : (
        <>
          <div className="cv-intro">
            <h1>Report a ward issue</h1>
            <p>Tell the ward officer what you saw and where to find it.</p>
          </div>
          <form className="cv-form" onSubmit={submit}>
            <section className="cv-panel">
              <h2>
                <MessageSquareText size={20} />
                Report details
              </h2>
              <label className="cv-field">
                Report language
                <select
                  name="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी · Hindi</option>
                </select>
              </label>
              <label className="cv-field">
                Description
                <textarea
                  name="description"
                  lang={language}
                  maxLength={2000}
                  required
                  rows={5}
                  placeholder={
                    language === "hi" ? "आपने क्या देखा?" : "What did you see?"
                  }
                />
              </label>
              <label className="cv-field">
                Landmark
                <input
                  name="landmark"
                  value={landmark}
                  maxLength={160}
                  onChange={(e) => setLandmark(e.target.value)}
                  required
                  placeholder={
                    language === "hi"
                      ? "पास की कोई पहचान"
                      : "Nearby shop, gate, or street corner"
                  }
                />
              </label>
              <label className="cv-field" htmlFor="report-photo">
                <span>
                  <Camera size={16} /> Photo <small>(optional)</small>
                </span>
              </label>
              <input
                id="report-photo"
                aria-label="Photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="cv-file"
                aria-describedby="photo-help"
              />
              <p id="photo-help" className="cv-tip">
                JPEG, PNG or WebP · up to 5 MB
              </p>
            </section>
            <section className="cv-panel">
              <h2>
                <MapPin size={20} />
                Issue location
              </h2>
              <p className="cv-tip cv-paragraph">
                Tap the map to drop a pin, or choose a nearby demo landmark.
              </p>
              <LocationMap
                value={point}
                onPick={(p) => {
                  setPoint(p);
                  setPlace("");
                }}
              />
              <label className="cv-field">
                Demo landmark
                <select
                  value={place}
                  onChange={(e) => {
                    const place = places.find((s) => s.id === e.target.value);
                    setPlace(e.target.value);
                    if (place) {
                      setPoint({ lat: place.lat, lng: place.lng });
                      setLandmark(place.name);
                    } else setPoint(undefined);
                  }}
                >
                  <option value="">Choose a landmark</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {point && (
                <p className="cv-tip" role="status">
                  Selected coordinates · {point.lat.toFixed(5)},{" "}
                  {point.lng.toFixed(5)}
                </p>
              )}
            </section>
            <div className="cv-submit">
              {error && (
                <p className="cv-error" role="alert">
                  {error}
                </p>
              )}
              <button className="cv-button" disabled={busy}>
                <Send size={16} />
                {busy ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        </>
      )}
    </CivicShell>
  );
}
