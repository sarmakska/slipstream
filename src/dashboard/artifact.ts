import type { ProjectMap } from "../map/types.js";
import type { MindMapNode } from "./model.js";
import { mindMapToMermaid } from "./model.js";

/**
 * Render a self contained HTML artifact for the project mind map and stats. The
 * primary slipstream experience is in chat, but a single file HTML artifact is
 * handy to open in a browser or attach to a PR. It pulls Mermaid from a CDN and
 * carries the SarmaLinux palette so it matches the brand.
 */
export function renderArtifact(map: ProjectMap, tree: MindMapNode): string {
  const mermaid = mindMapToMermaid(tree, 200);
  const projectName = map.root.split("/").filter(Boolean).pop() ?? "project";
  const sizeKiB = (map.stats.totalBytes / 1024).toFixed(1);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>slipstream mind map: ${escapeHtml(projectName)}</title>
<style>
  :root {
    --bg: #06060c; --surface: #0d1117; --sky: #38bdf8; --cyan: #22d3ee;
    --emerald: #34d399; --fg: #f5f7fa; --muted: #8b9bb4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  header { padding: 24px 28px; border-bottom: 1px solid #1b2430; }
  .prompt { color: var(--emerald); }
  .path { color: #60a5fa; }
  h1 { font-size: 18px; margin: 0; font-weight: 700; }
  .tagline { color: var(--muted); margin-top: 6px; font-size: 13px; }
  .stats { display: flex; gap: 24px; padding: 18px 28px; flex-wrap: wrap; }
  .stat { background: var(--surface); border: 1px solid #1b2430; border-radius: 10px; padding: 12px 16px; }
  .stat b { color: var(--cyan); font-size: 20px; display: block; }
  .stat span { color: var(--muted); font-size: 12px; }
  .map { padding: 12px 28px 40px; }
  .mermaid { background: var(--surface); border: 1px solid #1b2430; border-radius: 12px; padding: 16px; }
  footer { padding: 18px 28px; color: var(--muted); font-size: 12px; border-top: 1px solid #1b2430; }
  a { color: var(--sky); }
</style>
</head>
<body>
<header>
  <h1><span class="prompt">visitor@sarmalinux</span>:<span class="path">~</span>$ slipstream mindmap</h1>
  <div class="tagline">slipstream by sarmalinux . live project mind map for ${escapeHtml(projectName)}</div>
</header>
<section class="stats">
  <div class="stat"><b>${map.stats.fileCount}</b><span>files indexed</span></div>
  <div class="stat"><b>${map.stats.symbolCount}</b><span>exported symbols</span></div>
  <div class="stat"><b>${sizeKiB} KiB</b><span>source size</span></div>
  <div class="stat"><b>${map.entryPoints.length}</b><span>entry points</span></div>
</section>
<section class="map">
  <pre class="mermaid">
${escapeHtml(mermaid)}
  </pre>
</section>
<footer>
  Generated ${escapeHtml(map.generatedAt)} . SarmaLinux . <a href="https://sarmalinux.com">sarmalinux.com</a> . <a href="https://github.com/sarmakska/slipstream">github.com/sarmakska/slipstream</a>
</footer>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "base" });
</script>
</body>
</html>
`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
