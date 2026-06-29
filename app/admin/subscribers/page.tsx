"use client";

import { useState } from "react";

type SubscriberStatus =
  | "pending_telegram_link"
  | "pending_approval"
  | "approved"
  | "denied"
  | "revoked";

interface Subscriber {
  id: string;
  channel: "telegram" | "whatsapp" | "sms";
  name?: string;
  phone?: string;
  telegramChatId?: string;
  status: SubscriberStatus;
  createdAt: number;
  approvedAt?: number;
}

const CREAM = "#f5f0e8";
const INK = "#1a1a1a";
const ACCENT = "#8a2424";

const STATUS_LABEL: Record<SubscriberStatus, string> = {
  pending_telegram_link: "Awaiting Telegram /start",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  denied: "Denied",
  revoked: "Revoked",
};

const STATUS_COLOR: Record<SubscriberStatus, string> = {
  pending_telegram_link: "#8a6d1a",
  pending_approval: "#8a6d1a",
  approved: "#2e7d32",
  denied: "#888",
  revoked: "#c62828",
};

export default function AdminSubscribersPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [subs, setSubs] = useState<Subscriber[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load(s: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscribers", {
        headers: { "x-admin-secret": s },
      });
      if (res.status === 401) {
        setError("Incorrect password.");
        setUnlocked(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSubs(data.subscribers ?? []);
      setUnlocked(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch("/api/admin/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await load(secret);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to revoke.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Permanently remove this record? This can't be undone.")) return;
    setRemovingId(id);
    try {
      const res = await fetch("/api/admin/subscribers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await load(secret);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CREAM,
        color: INK,
        fontFamily: '"IBM Plex Sans", sans-serif',
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 900,
            fontSize: 32,
            marginBottom: 8,
          }}
        >
          Subscribers
        </h1>
        <p style={{ color: "#555", marginBottom: 32, lineHeight: 1.5 }}>
          Review who has access to alerts, and revoke it if needed.
        </p>

        {!unlocked ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              load(secret);
            }}
            style={{ display: "flex", gap: 8, maxWidth: 380 }}
          >
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Admin password"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 4,
                border: "1px solid #ccc",
                fontSize: 15,
                fontFamily: '"IBM Plex Sans", sans-serif',
              }}
            />
            <button
              type="submit"
              disabled={loading || !secret}
              style={{
                padding: "10px 20px",
                borderRadius: 4,
                border: "none",
                background: ACCENT,
                color: "#fff",
                fontSize: 15,
                fontWeight: 500,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Checking…" : "Unlock"}
            </button>
          </form>
        ) : (
          <>
            {subs && subs.length === 0 && <p>No subscribers yet.</p>}
            {subs && subs.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
                    <th style={{ padding: "8px 6px" }}>Name</th>
                    <th style={{ padding: "8px 6px" }}>Channel</th>
                    <th style={{ padding: "8px 6px" }}>Contact</th>
                    <th style={{ padding: "8px 6px" }}>Status</th>
                    <th style={{ padding: "8px 6px" }}>Requested</th>
                    <th style={{ padding: "8px 6px" }} />
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "8px 6px" }}>{s.name || "—"}</td>
                      <td style={{ padding: "8px 6px", textTransform: "capitalize" }}>
                        {s.channel === "sms" ? "SMS" : s.channel}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {s.phone || s.telegramChatId || "—"}
                      </td>
                      <td style={{ padding: "8px 6px", color: STATUS_COLOR[s.status], fontWeight: 500 }}>
                        {STATUS_LABEL[s.status]}
                      </td>
                      <td style={{ padding: "8px 6px", color: "#777" }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        {s.status === "approved" && (
                          <button
                            onClick={() => revoke(s.id)}
                            disabled={revokingId === s.id}
                            style={{
                              background: "none",
                              border: `1px solid ${ACCENT}`,
                              color: ACCENT,
                              borderRadius: 4,
                              padding: "6px 12px",
                              fontSize: 13,
                              cursor: revokingId === s.id ? "default" : "pointer",
                            }}
                          >
                            {revokingId === s.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                        {s.status !== "approved" && (
                          <button
                            onClick={() => remove(s.id)}
                            disabled={removingId === s.id}
                            style={{
                              background: "none",
                              border: "1px solid #999",
                              color: "#555",
                              borderRadius: 4,
                              padding: "6px 12px",
                              fontSize: 13,
                              cursor: removingId === s.id ? "default" : "pointer",
                            }}
                          >
                            {removingId === s.id ? "Removing…" : "Remove"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {error && (
          <p style={{ color: ACCENT, marginTop: 16 }}>{error}</p>
        )}
      </div>
    </main>
  );
}
