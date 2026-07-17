/**
 * Shared HTML-escaping helper for any user-supplied string that gets
 * interpolated into HTML — approval emails, approve/deny confirmation pages,
 * the contact form email. Subscriber name/email are attacker-controlled
 * (public /api/subscribe), so anything rendering them in the admin's browser
 * or email client must escape them first.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
