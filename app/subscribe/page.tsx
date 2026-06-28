"use client";

import { useState } from "react";

type Channel = "telegram" | "whatsapp" | "sms";

const CREAM = "#f5f0e8";
const INK = "#1a1a1a";
const ACCENT = "#8a2424";

export default function SubscribePage() {
  const [channel, setChannel] = useState<Channel>("telegram");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; deepLink?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, phone, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Something went wrong." });
      } else if (data.telegramDeepLink) {
        setResult({ ok: true, message: data.message, deepLink: data.telegramDeepLink });
      } else {
        setResult({ ok: true, message: data.warning ?? data.message ?? "Request submitted." });
      }
    } catch {
      setResult({ ok: false, message: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CREAM,
        color: INK,
        fontFamily: '"IBM Plex Sans", sans-serif',
        display: "flex",
        justifyContent: "center",
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%" }}>
        <h1
          style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 900,
            fontSize: 32,
            marginBottom: 8,
          }}
        >
          Get Alerts
        </h1>
        <p style={{ color: "#555", marginBottom: 32, lineHeight: 1.5 }}>
          Register to receive breaking sanctions, export-control, and enforcement
          alerts. Every request is reviewed before alerts start.
        </p>

        {result ? (
          <div
            style={{
              background: result.ok ? "#eaf3ea" : "#f6e4e4",
              border: `1px solid ${result.ok ? "#bcd9bc" : "#dcb0b0"}`,
              borderRadius: 6,
              padding: 20,
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0, marginBottom: result.deepLink ? 16 : 0 }}>{result.message}</p>
            {result.deepLink && (
              <a
                href={result.deepLink}
                style={{
                  display: "inline-block",
                  background: "#229ED9",
                  color: "#fff",
                  textDecoration: "none",
                  padding: "10px 20px",
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                Open Telegram &amp; tap Start
              </a>
            )}
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setResult(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: ACCENT,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  font: "inherit",
                }}
              >
                Register another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6, fontWeight: 500 }}>
              Name (optional)
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Doe"
              style={inputStyle}
            />

            <label style={{ display: "block", fontSize: 14, marginBottom: 6, marginTop: 18, fontWeight: 500 }}>
              How should we reach you?
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(["telegram", "whatsapp", "sms"] as Channel[]).map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setChannel(c)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 4,
                    border: `1px solid ${channel === c ? ACCENT : "#ccc"}`,
                    background: channel === c ? ACCENT : "#fff",
                    color: channel === c ? "#fff" : INK,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {c === "sms" ? "SMS" : c}
                </button>
              ))}
            </div>

            {channel !== "telegram" && (
              <>
                <label style={{ display: "block", fontSize: 14, marginBottom: 6, fontWeight: 500 }}>
                  Phone number (with country code)
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+14155551234"
                  required
                  style={inputStyle}
                />
              </>
            )}

            {channel === "telegram" && (
              <p style={{ fontSize: 13, color: "#777", lineHeight: 1.5, marginBottom: 18 }}>
                After submitting, you'll get a link to open Telegram and tap Start —
                that's how the bot knows where to send your alerts.
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 0",
                borderRadius: 4,
                border: "none",
                background: busy ? "#a87a7a" : ACCENT,
                color: "#fff",
                fontSize: 15,
                fontWeight: 500,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? "Submitting…" : "Request access"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 4,
  border: "1px solid #ccc",
  fontSize: 15,
  fontFamily: '"IBM Plex Sans", sans-serif',
  boxSizing: "border-box",
};
