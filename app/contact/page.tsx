"use client";

import { useState } from "react";

const CREAM = "#f5f0e8";
const INK = "#1a1a1a";
const ACCENT = "#8a2424";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Something went wrong." });
      } else {
        setResult({ ok: true, message: "Thanks — your message has been sent." });
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
          Contact Us
        </h1>
        <p style={{ color: "#555", marginBottom: 16, lineHeight: 1.5 }}>
          Questions, feedback, or corrections — send a message and it goes straight to us.
        </p>
        <p style={{ color: "#555", marginBottom: 32, lineHeight: 1.5, fontSize: 14 }}>
          Looking to receive breaking alerts instead?{" "}
          <a href="/subscribe" style={{ color: ACCENT, fontWeight: 500 }}>
            Register for alerts →
          </a>
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
            <p style={{ margin: 0 }}>{result.message}</p>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => {
                  setResult(null);
                  if (result.ok) {
                    setName("");
                    setEmail("");
                    setMessage("");
                  }
                }}
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
                {result.ok ? "Send another message" : "Try again"}
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />

            <label style={{ display: "block", fontSize: 14, marginBottom: 6, marginTop: 18, fontWeight: 500 }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              required
              rows={6}
              style={{ ...inputStyle, resize: "vertical", fontFamily: '"IBM Plex Sans", sans-serif' }}
            />

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                marginTop: 18,
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
              {busy ? "Sending…" : "Send message"}
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
