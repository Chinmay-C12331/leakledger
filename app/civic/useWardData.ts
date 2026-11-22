"use client";
import { useCallback, useEffect, useState } from "react";

export function useWardData<T>(url: string) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true,
      controller: AbortController | undefined;
    setData(undefined);
    const read = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: request.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This tracking link could not be found."
              : "Updates could not be loaded. Please try again.",
          );
        const value: T = await response.json();
        if (active && !request.signal.aborted) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active && !request.signal.aborted) {
          setData(undefined);
          setError(
            e instanceof Error ? e.message : "Updates could not be loaded.",
          );
        }
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void read();
    };
    setError("");
    void read();
    const timer = window.setInterval(visible, 20000);
    window.addEventListener("focus", visible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
    };
  }, [url, attempt]);
  return { data, error, retry };
}
