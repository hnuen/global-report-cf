// Tiny shared HTML shell for the approve/deny landing pages — these are
// opened directly in a browser from the admin email, so plain JSON would be
// a bad experience. Not a route itself (no GET/POST export), just a helper.
export function confirmationPage(message: string, ok: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Global Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'IBM Plex Sans',sans-serif;color:#1a1a1a;">
  <div style="max-width:480px;margin:80px auto;padding:0 20px;text-align:center;">
    <div style="font-size:40px;margin-bottom:16px;">${ok ? "✅" : "⚠️"}</div>
    <p style="font-size:17px;line-height:1.5;">${message}</p>
  </div>
</body>
</html>`;
}
