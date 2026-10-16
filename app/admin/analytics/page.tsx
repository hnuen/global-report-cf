"use client";
/**
 * Admin visitor-analytics dashboard. Enter ADMIN_SECRET, then see live online
 * count, visit totals, a daily trend, and country/city breakdowns. All data is
 * aggregate (no PII). Talks to GET /api/admin/analytics with x-admin-secret.
 */
import { useState } from "react";

const CREAM = "#f5f0e8";
const INK = "#1a1a1a";
const ACCENT = "#8a2424";
const GREEN = "#15803d";

interface Report {
  online: number;
  visitsTotal: number;
  daily: { date: string; visits: number; uniques: number }[];
  countries: { code: string; visits: number }[];
  cities: { code: string; city: string; visits: number }[];
  generatedAt: string;
}

// ISO country code -> flag emoji (regional indicator pairs).
function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "🏳️";
  return cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default function AdminAnalyticsPage() {
  const [secret, setSecret] = useState("");
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(d = days, s = secret) {
    if (!s) { setError("Enter the admin secret."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, { headers: { "x-admin-secret": s } });
      if (res.status === 401) { setError("Unauthorized — check the secret."); setReport(null); return; }
      if (!res.ok) { setError(`Error ${res.status}`); return; }
      setReport(await res.json());
    } catch (e) {
      setError("Request failed: " + String(e).slice(0, 120));
    } finally {
      setLoading(false);
    }
  }

  const maxVisits = report ? Math.max(1, ...report.daily.map(d => d.visits)) : 1;
  const totalWindow = report ? report.daily.reduce((a, d) => a + d.visits, 0) : 0;

  return (
    <div style={{ minHeight: "100vh", background: CREAM, color: INK, fontFamily: "'IBM Plex Sans',system-ui,sans-serif", padding: "28px 18px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "1.7rem", margin: "0 0 2px" }}>Visitor Analytics</h1>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".66rem", color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", margin: "0 0 20px" }}>
          The Global Report · aggregate, no personal data
        </p>

        {/* Auth + controls */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
          <input
            type="password" placeholder="Admin secret" value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            style={{ padding: "9px 11px", border: "1px solid #d1cbbd", borderRadius: 4, fontSize: ".85rem", background: "#fff", minWidth: 220 }}
          />
          <select value={days} onChange={e => { const d = Number(e.target.value); setDays(d); if (report) load(d); }}
            style={{ padding: "9px 10px", border: "1px solid #d1cbbd", borderRadius: 4, fontSize: ".82rem", background: "#fff" }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={() => load()} disabled={loading}
            style={{ padding: "9px 18px", border: "none", borderRadius: 4, background: ACCENT, color: "#fff", fontSize: ".85rem", cursor: "pointer", opacity: loading ? .6 : 1 }}>
            {loading ? "Loading…" : report ? "Refresh" : "Load"}
          </button>
          {report && (
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".62rem", color: "#9ca3af", marginLeft: "auto" }}>
              as of {new Date(report.generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {error && <div style={{ background: "#fde8e8", color: "#9b1c1c", padding: "10px 14px", borderRadius: 4, marginBottom: 18, fontSize: ".82rem" }}>{error}</div>}

        {report && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 26 }}>
              <Stat label="Online now" value={report.online.toLocaleString()} color={GREEN} live />
              <Stat label={`Visits · ${days}d`} value={totalWindow.toLocaleString()} color={INK} />
              <Stat label="Visits · all time" value={report.visitsTotal.toLocaleString()} color={INK} />
              <Stat label="Countries" value={report.countries.length.toLocaleString()} color={INK} />
            </div>

            {/* Daily trend */}
            <Section title={`Daily visits · last ${days} days`}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, padding: "6px 0" }}>
                {report.daily.map(d => (
                  <div key={d.date} title={`${d.date}: ${d.visits} visits, ${d.uniques} unique`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ height: `${(d.visits / maxVisits) * 100}%`, background: ACCENT, borderRadius: "2px 2px 0 0", minHeight: d.visits ? 2 : 0 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono',monospace", fontSize: ".58rem", color: "#9ca3af", marginTop: 4 }}>
                <span>{report.daily[0]?.date}</span><span>{report.daily[report.daily.length - 1]?.date}</span>
              </div>
            </Section>

            {/* Geo tables */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
              <Section title="Top countries">
                <GeoTable rows={report.countries.slice(0, 25).map(c => ({ label: `${flag(c.code)} ${c.code}`, visits: c.visits }))} empty="No country data yet." />
              </Section>
              <Section title="Top cities">
                <GeoTable rows={report.cities.slice(0, 25).map(c => ({ label: `${flag(c.code)} ${c.city || "—"}`, visits: c.visits }))} empty="No city data yet (Cloudflare provides it best-effort)." />
              </Section>
            </div>
          </>
        )}

        {!report && !error && (
          <p style={{ color: "#6b7280", fontSize: ".9rem" }}>Enter the admin secret and press Load to view visitor analytics.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, live }: { label: string; value: string; color: string; live?: boolean }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8e2d6", borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".58rem", color: "#9ca3af", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
        {live && <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block" }} />}{label}
      </div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8e2d6", borderRadius: 6, padding: "14px 16px", marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "1rem", margin: "0 0 10px" }}>{title}</h2>
      {children}
    </div>
  );
}

function GeoTable({ rows, empty }: { rows: { label: string; visits: number }[]; empty: string }) {
  if (rows.length === 0) return <p style={{ color: "#9ca3af", fontSize: ".8rem", margin: 0 }}>{empty}</p>;
  const max = Math.max(1, ...rows.map(r => r.visits));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".82rem" }}>
          <span style={{ width: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
          <div style={{ flex: 1, background: "#f0ece2", borderRadius: 3, height: 12, overflow: "hidden" }}>
            <div style={{ width: `${(r.visits / max) * 100}%`, height: "100%", background: ACCENT }} />
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".72rem", color: "#6b7280", width: 48, textAlign: "right" }}>{r.visits.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
