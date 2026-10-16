import type { Metadata, Viewport } from "next";
import PresenceBadge from "./components/PresenceBadge";

export const metadata: Metadata = {
  title: "The Global Report",
  description: "Sanctions · Economics · Regions · OCC · Penalties · BIS/Export Controls",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f0e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#f5f0e8" }}>
        {children}
        <footer style={{ textAlign: "center", padding: "18px 12px 24px", fontFamily: "'IBM Plex Mono',monospace", fontSize: ".58rem", color: "#9ca3af", letterSpacing: ".08em" }}>
          <a href="/privacy" style={{ color: "#9ca3af", textDecoration: "none" }}>Privacy</a>
          <span style={{ margin: "0 8px" }}>·</span>
          <a href="/contact" style={{ color: "#9ca3af", textDecoration: "none" }}>Contact</a>
        </footer>
        <PresenceBadge />
      </body>
    </html>
  );
}
