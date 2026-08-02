"use client";

import { FormEvent, useState } from "react";

type Settings = { threshold: number; maxAgeHours: number | null; maxAlertsPerRun: number };

const fieldStyle = { width: "100%", padding: "10px 12px", border: "1px solid #bbb", borderRadius: 4, fontSize: 15 };

export default function AlertSettingsPage() {
  const [secret, setSecret] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/alert-settings", { headers: { "x-admin-secret": secret } }).catch(() => null);
    if (!response?.ok) setMessage(response?.status === 401 ? "Incorrect admin password." : "Could not load settings.");
    else setSettings((await response.json()).settings);
    setBusy(false);
  }

  async function save() {
    if (!settings) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/alert-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(settings),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setMessage(response?.ok ? "Saved. The next monitor run will use these settings." : data.error ?? "Could not save settings.");
    setBusy(false);
  }

  return <main style={{ minHeight: "100vh", background: "#f5f0e8", color: "#1a1a1a", padding: "48px 20px", fontFamily: '"IBM Plex Sans", sans-serif' }}>
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 32, marginBottom: 8 }}>Alert controls</h1>
      <p style={{ color: "#555", lineHeight: 1.55, marginBottom: 28 }}>Adjust alert sensitivity without redeploying. Trusted source, direct article link, non-AI, and meaningful-news checks always remain enforced.</p>
      {!settings ? <form onSubmit={load} style={{ display: "flex", gap: 8 }}>
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin password" style={fieldStyle} />
        <button disabled={busy || !secret} style={{ padding: "10px 20px", background: "#8a2424", color: "white", border: 0, borderRadius: 4 }}>{busy ? "Checking..." : "Unlock"}</button>
      </form> : <div style={{ display: "grid", gap: 22 }}>
        <label>Minimum alert score (0–100)
          <input type="number" min={0} max={100} value={settings.threshold} onChange={e => setSettings({ ...settings, threshold: Number(e.target.value) })} style={{ ...fieldStyle, marginTop: 7 }} />
          <small style={{ color: "#666" }}>Higher means fewer alerts. Recommended: 65.</small>
        </label>
        <label>Publication age
          <select value={settings.maxAgeHours === null ? "today" : String(settings.maxAgeHours)} onChange={e => setSettings({ ...settings, maxAgeHours: e.target.value === "today" ? null : Number(e.target.value) })} style={{ ...fieldStyle, marginTop: 7 }}>
            <option value="today">Today only (recommended)</option><option value="24">Last 24 hours</option><option value="48">Last 48 hours</option><option value="72">Last 72 hours</option><option value="168">Last 7 days</option>
          </select>
        </label>
        <label>Maximum alerts per monitor run (1–10)
          <input type="number" min={1} max={10} value={settings.maxAlertsPerRun} onChange={e => setSettings({ ...settings, maxAlertsPerRun: Number(e.target.value) })} style={{ ...fieldStyle, marginTop: 7 }} />
        </label>
        <button onClick={save} disabled={busy} style={{ padding: "12px 20px", background: "#8a2424", color: "white", border: 0, borderRadius: 4, fontWeight: 600 }}>{busy ? "Saving..." : "Save alert settings"}</button>
      </div>}
      {message && <p style={{ color: message.startsWith("Saved") ? "#2e7d32" : "#8a2424", marginTop: 18 }}>{message}</p>}
    </div>
  </main>;
}
