/**
 * Privacy note — covers the anonymous visitor analytics added in Phase 1.
 * Plain server component; styled to match the site's cream/serif look.
 */
export const metadata = { title: "Privacy · The Global Report" };

export default function PrivacyPage() {
  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#f5f0e8", color: "#1a1a1a", fontFamily: "'IBM Plex Sans',system-ui,sans-serif", padding: "40px 20px" };
  const inner: React.CSSProperties = { maxWidth: 720, margin: "0 auto", lineHeight: 1.6 };
  const h2: React.CSSProperties = { fontFamily: "'Playfair Display',Georgia,serif", fontSize: "1.15rem", margin: "26px 0 8px" };
  return (
    <div style={wrap}>
      <div style={inner}>
        <a href="/" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".66rem", color: "#8a2424", textDecoration: "none", letterSpacing: ".08em", textTransform: "uppercase" }}>← The Global Report</a>
        <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "1.9rem", margin: "14px 0 4px" }}>Privacy</h1>
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".62rem", color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", margin: 0 }}>How we handle visitor data</p>

        <h2 style={h2}>Visitor analytics</h2>
        <p>We keep a lightweight, privacy-preserving count of how many people are reading and where visitors are, in aggregate. To do this we store a random, anonymous identifier in your browser (in local storage, not a tracking cookie) so repeat visits in the same browser aren&apos;t double-counted. This identifier is not linked to your name, email, or any account, and it isn&apos;t shared with anyone.</p>

        <h2 style={h2}>What we store</h2>
        <p>Only aggregate numbers: total and daily visit counts, an approximate count of unique visitors per day, how many people are currently online, and tallies of visitors by country and (where available) city. We do <strong>not</strong> store your IP address. Your IP is used only momentarily, in transit, to look up an approximate country/city and to limit abuse, and is then discarded.</p>

        <h2 style={h2}>What we don&apos;t do</h2>
        <p>No advertising trackers, no selling of data, no cross-site profiling, and no third-party analytics services. Location is approximate and derived from network data provided by our content-delivery network; it is never precise and is used only for aggregate reporting.</p>

        <h2 style={h2}>Your choice</h2>
        <p>Clearing your browser&apos;s site data removes the anonymous identifier. Blocking local storage, or browsing in private mode, prevents it from persisting at all; the site still works normally.</p>

        <p style={{ marginTop: 24, fontSize: ".85rem", color: "#6b7280" }}>Questions? Use the <a href="/contact" style={{ color: "#8a2424" }}>contact page</a>.</p>
      </div>
    </div>
  );
}
