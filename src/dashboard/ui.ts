/**
 * Fallback page for when the React dashboard bundle has not been built yet.
 *
 * The dashboard is now a single React app under `web/`, emitted to `dist/.../web`
 * by `vite build` and served from there. This stub only renders when that bundle
 * is missing (a dev checkout that ran the server before building), so there is
 * exactly one real UI and no second dashboard to drift out of sync.
 */

export function renderDashboardHtml(_session: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>slipstream</title>
<style>
  html,body{margin:0;height:100%;background:#05060a;color:#f5f7fa;
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .wrap{height:100%;display:grid;place-items:center;text-align:center;padding:24px}
  .name{font-size:22px;font-weight:800;background:linear-gradient(135deg,#34d399,#22d3ee,#60a5fa);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  p{color:#8b9bb4;max-width:460px;line-height:1.6}
  code{background:#10141e;border:1px solid #1a2230;border-radius:6px;padding:2px 8px;color:#f5f7fa}
</style>
</head>
<body>
  <div class="wrap">
    <div>
      <div class="name">slipstream</div>
      <p>The dashboard UI has not been built yet. Run <code>npm run build</code>
      (or <code>npm run web:build</code>) and reload to open the full dashboard.</p>
    </div>
  </div>
</body>
</html>`;
}
