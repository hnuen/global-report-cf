"use client";

import { useState, Fragment } from "react";
import { ALERT_CATEGORIES, describeSections, sectionsToCategoryKeys } from "@/src/lib/alert-categories";

type SubscriberStatus =
  | "pending_telegram_link"
  | "pending_approval"
  | "approved"
  | "denied"
  | "revoked";

interface Subscriber {
  id: string;
  channel: "telegram" | "whatsapp" | "sms" | "ntfy";
  name?: string;
  phone?: string;
  email?: string;
  telegramChatId?: string;
  ntfyTopic?: string;
  sections?: string[];
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCats, setEditCats] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  function startEdit(s: Subscriber) {
    setEditingId(s.id);
    setEditCats(sectionsToCategoryKeys(s.sections));
    setError(null);
  }
  const toggleEditCat = (key: string) =>
    setEditCats(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  async function saveCats(id: string) {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/subscribers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id, categories: editCats }),
      });
      if (res.ok) {
        setEditingId(null);
        await load(secret);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save categories.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSavingId(null);
    }
  }

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

  function logout() {
    setUnlocked(false);
    setSecret("");
    setSubs(null);
    setError(null);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
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
          {unlocked && (
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "1px solid #999",
                color: "#555",
                borderRadius: 4,
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginTop: 4,
              }}
            >
              Log out
            </button>
          )}
        </div>
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
                    <th style={{ padding: "8px 6px" }}>Categories</th>
                    <th style={{ padding: "8px 6px" }}>Requested</th>
                    <th style={{ padding: "8px 6px" }} />
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <Fragment key={s.id}>
                    <tr style={{ borderBottom: editingId === s.id ? "none" : "1px solid #ddd" }}>
                      <td style={{ padding: "8px 6px" }}>{s.name || "—"}</td>
                      <td style={{ padding: "8px 6px", textTransform: "capitalize" }}>
                        {s.channel === "sms" ? "SMS" : s.channel}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {s.channel === "ntfy"
                          ? (s.ntfyTopic ? `topic: ${s.ntfyTopic}` : "—") + (s.email ? ` / ${s.email}` : "")
                          : s.phone || s.telegramChatId || "—"
                        }
                      </td>
                      <td style={{ padding: "8px 6px", color: STATUS_COLOR[s.status], fontWeight: 500 }}>
                        {STATUS_LABEL[s.status]}
                      </td>
                      <td style={{ padding: "8px 6px", color: "#555", maxWidth: 170 }}>
                        {describeSections(s.sections)}
                      </td>
                      <td style={{ padding: "8px 6px", color: "#777" }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => (editingId === s.id ? setEditingId(null) : startEdit(s))}
                          style={{
                            background: "none",
                            border: "1px solid #999",
                            color: "#555",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            marginRight: 6,
                          }}
                        >
                          {editingId === s.id ? "Close" : "Categories"}
                        </button>
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
                    {editingId === s.id && (
                      <tr style={{ borderBottom: "1px solid #ddd" }}>
                        <td colSpan={7} style={{ padding: "4px 6px 16px", background: "#faf7f2" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>Authorize:</span>
                            {ALERT_CATEGORIES.map(c => (
                              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={editCats.includes(c.key)}
                                  onChange={() => toggleEditCat(c.key)}
                                />
                                {c.label}
                              </label>
                            ))}
                            <button
                              onClick={() => saveCats(s.id)}
                              disabled={savingId === s.id || editCats.length === 0}
                              style={{
                                background: ACCENT,
                                border: "none",
                                color: "#fff",
                                borderRadius: 4,
                                padding: "6px 14px",
                                fontSize: 13,
                                cursor: savingId === s.id || editCats.length === 0 ? "default" : "pointer",
                                opacity: editCats.length === 0 ? 0.5 : 1,
                              }}
                            >
                              {savingId === s.id ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
