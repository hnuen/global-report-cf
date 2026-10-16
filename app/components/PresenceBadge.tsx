"use client";
/**
 * PresenceBadge — a small live "N reading now" indicator, and the single place
 * the client heartbeat runs from. It keeps an anonymous random visitor id in
 * localStorage (no cookie, no PII), POSTs /api/presence every 30s while the tab
 * is visible, and shows the online count the endpoint returns.
 */
import { useEffect, useRef, useState } from "react";

const BEAT_MS = 30_000;
const VID_KEY = "gr_vid";

function getVid(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v || v.length < 8) {
      v = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
        .replace(/[^a-zA-Z0-9_-]/g, "");
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    // Private mode / storage blocked — fall back to an ephemeral per-load id.
    return Math.random().toString(36).slice(2, 18);
  }
}

export default function PresenceBadge() {
  const [online, setOnline] = useState<number | null>(null);
  const vidRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    vidRef.current = getVid();
    let cancelled = false;

    async function beat() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vid: vidRef.current }),
          cache: "no-store",
          keepalive: true,
        });
        if (!res.ok) return;
        const data = await res.json() as { online?: number };
        if (!cancelled && typeof data.online === "number") setOnline(data.online);
      } catch { /* offline / transient — keep last value */ }
    }

    beat();
    timerRef.current = setInterval(beat, BEAT_MS);
    const onVis = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (online === null || online < 1) return null;

  return (
    <div
      aria-label={`${online} reading now`}
      title={`${online} ${online === 1 ? "person" : "people"} reading right now`}
      style={{
        position: "fixed", right: 14, bottom: 14, zIndex: 50,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 11px", borderRadius: 999,
        background: "rgba(255,255,255,.95)", border: "1px solid #e3ddd0",
        boxShadow: "0 1px 6px rgba(0,0,0,.08)",
        fontFamily: "'IBM Plex Mono',monospace", fontSize: ".62rem",
        color: "#15803d", letterSpacing: ".02em", pointerEvents: "none",
        backdropFilter: "saturate(1.2) blur(2px)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "grPulse 2s infinite" }} />
      {online.toLocaleString()} reading now
      <style>{"@keyframes grPulse{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
    </div>
  );
}
