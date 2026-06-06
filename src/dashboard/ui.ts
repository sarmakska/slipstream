/**
 * The dashboard UI, served as one self-contained HTML document. No build step,
 * no framework, no bundler, no CDN: every byte ships from the local server so
 * the dashboard works offline and on air-gapped machines. Bound to 127.0.0.1.
 *
 * v0.7 redesign: tabbed navigation across Live, Project, Journal, Sessions and
 * Memory. Heatmap calendar, donut and bar charts, per-day journal, session
 * management with delete actions, expanded memory search. Pure inline SVG and
 * vanilla JS; no external assets.
 */

export function renderDashboardHtml(session: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>slipstream . ${escapeHtml(session)}</title>
<style>
  :root {
    --bg:#05060a; --bg-2:#080a12; --surface:#0d1117; --surface-2:#10141e;
    --line:#1a2230; --line-2:#222b3b; --sky:#38bdf8; --cyan:#22d3ee;
    --emerald:#34d399; --blue:#60a5fa; --violet:#a78bfa; --fg:#f5f7fa;
    --muted:#8b9bb4; --muted-2:#5b6478; --amber:#fbbf24; --red:#f87171;
    --rose:#fb7185; --pink:#ec4899; --indigo:#818cf8;
    --gradient: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #60a5fa 100%);
    --gradient-violet: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background:
      radial-gradient(1200px 600px at 80% -10%, rgba(96,165,250,0.10), transparent 60%),
      radial-gradient(900px 500px at 10% 110%, rgba(52,211,153,0.10), transparent 60%),
      linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%);
    color:var(--fg);
    font-family:'JetBrains Mono','SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:13px;line-height:1.55;min-height:100vh;
  }
  a{color:var(--sky);text-decoration:none} a:hover{color:var(--cyan)}
  button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
  ::selection{background:rgba(56,189,248,0.25)}

  /* HEADER */
  header{
    position:sticky;top:0;z-index:20;
    backdrop-filter:blur(14px) saturate(160%);
    -webkit-backdrop-filter:blur(14px) saturate(160%);
    background:rgba(8,10,18,0.78);
    border-bottom:1px solid var(--line);
    padding:12px 20px;
    display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  }
  .brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;letter-spacing:-0.01em}
  .brand .dot{width:8px;height:8px;border-radius:50%;background:var(--gradient);box-shadow:0 0 12px rgba(52,211,153,0.6)}
  .brand .name{background:var(--gradient);-webkit-background-clip:text;background-clip:text;color:transparent}
  .ver{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:2px 6px;letter-spacing:0.04em}
  .spacer{flex:1}
  .control{
    display:inline-flex;align-items:center;gap:6px;
    border:1px solid var(--line);border-radius:7px;
    background:rgba(13,17,23,0.6);padding:5px 10px;
    font-size:11px;color:var(--muted);transition:all .15s;
  }
  .control:hover{border-color:var(--sky);color:var(--fg)}
  .control.active{border-color:var(--emerald);color:var(--emerald)}
  .conn-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:11px}
  .conn-dot{position:relative;width:7px;height:7px;border-radius:50%;background:var(--muted-2)}
  .conn-dot.live{background:var(--emerald)}
  .conn-dot.live::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--emerald);opacity:0.5;animation:ping 2s ease-in-out infinite}
  .conn-dot.warn{background:var(--amber)} .conn-dot.dead{background:var(--red)}
  @keyframes ping{0%{transform:scale(0.8);opacity:0.5}80%,100%{transform:scale(2.2);opacity:0}}
  .conn-pill select{background:transparent;color:var(--fg);border:0;font:inherit;padding:0;cursor:pointer}
  .conn-pill select:focus{outline:none}

  /* TABS */
  .tabs{
    display:flex;gap:4px;padding:0 20px;border-bottom:1px solid var(--line);
    background:rgba(8,10,18,0.6);backdrop-filter:blur(10px);
    position:sticky;top:62px;z-index:19;overflow-x:auto;
  }
  .tab{
    padding:10px 16px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;
    color:var(--muted);position:relative;white-space:nowrap;transition:color .15s;
    display:inline-flex;align-items:center;gap:7px;
  }
  .tab:hover{color:var(--fg)}
  .tab.on{color:var(--fg)}
  .tab.on::after{
    content:'';position:absolute;bottom:-1px;left:12px;right:12px;height:2px;
    background:var(--gradient);border-radius:2px;
  }
  .tab .badge{
    background:rgba(34,211,238,0.12);color:var(--cyan);
    border:1px solid rgba(34,211,238,0.3);border-radius:999px;
    padding:0 7px;font-size:9px;letter-spacing:0.05em;
  }

  /* PANELS */
  .view{display:none;padding:18px 20px}
  .view.on{display:block;animation:slidein .25s ease-out}
  @keyframes slidein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

  .panel{
    border:1px solid var(--line);border-radius:14px;
    background:linear-gradient(180deg, rgba(13,17,23,0.7), rgba(8,10,18,0.7));
    padding:16px 18px;overflow:hidden;
  }
  .panel h2{
    font-size:10px;letter-spacing:0.16em;text-transform:uppercase;
    color:var(--muted);margin:0 0 12px;
    display:flex;align-items:center;justify-content:space-between;gap:8px;
  }
  .panel h2 .badge{
    font-size:10px;color:var(--cyan);background:rgba(34,211,238,0.08);
    border:1px solid rgba(34,211,238,0.25);border-radius:999px;
    padding:1px 7px;letter-spacing:0.06em;text-transform:none;
  }

  /* GRIDS */
  .grid-3{display:grid;grid-template-columns:300px 1fr 360px;gap:14px}
  @media (max-width:1200px){.grid-3{grid-template-columns:260px 1fr 320px}}
  @media (max-width:900px){.grid-3{grid-template-columns:1fr}}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media (max-width:900px){.grid-2{grid-template-columns:1fr}}
  .grid-stack > * + *{margin-top:12px}

  /* KPI STRIP */
  .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
  @media (max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)}}
  @media (max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}}
  .kpi{
    position:relative;border:1px solid var(--line);border-radius:12px;
    background:linear-gradient(180deg, rgba(16,20,30,0.7), rgba(13,17,23,0.7));
    padding:12px 14px 10px;overflow:hidden;
    transition:border-color .2s, transform .2s;
  }
  .kpi:hover{border-color:var(--line-2);transform:translateY(-1px)}
  .kpi .lbl{font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:var(--muted);margin-bottom:6px}
  .kpi .val{font-size:22px;font-weight:700;letter-spacing:-0.02em;color:var(--fg);font-variant-numeric:tabular-nums}
  .kpi .sub{font-size:10px;color:var(--muted-2);margin-top:2px}
  .kpi .spark{position:absolute;right:8px;bottom:6px;width:64px;height:22px;opacity:0.85;pointer-events:none}
  .kpi.warn{border-color:rgba(251,191,36,0.4)} .kpi.compact{border-color:rgba(248,113,113,0.4)}
  .kpi.flash{animation:flash 0.6s ease-out}
  @keyframes flash{0%{box-shadow:0 0 0 0 rgba(56,189,248,0.35)}100%{box-shadow:0 0 0 0 transparent}}

  /* AGENTS / TIMELINE / etc shared bits from live */
  .agent{border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:8px;cursor:pointer;background:rgba(16,20,30,0.5);transition:all .15s}
  .agent:hover{border-color:var(--line-2);background:rgba(16,20,30,0.8)}
  .agent.sel{border-color:var(--sky);background:rgba(56,189,248,0.06);box-shadow:0 0 0 1px rgba(56,189,248,0.25)}
  .agent .name{color:var(--sky);font-weight:700;font-size:12px}
  .agent .task{color:var(--muted);font-size:11px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;float:right;padding:2px 7px;border-radius:999px;border:1px solid var(--line)}
  .running{color:var(--emerald);border-color:rgba(52,211,153,0.4)}
  .waiting{color:var(--amber);border-color:rgba(251,191,36,0.4)}
  .done{color:var(--muted);border-color:var(--line)}
  .failed{color:var(--red);border-color:rgba(248,113,113,0.4)}

  .filter-row{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
  .chip-btn{font-size:10px;letter-spacing:0.04em;border:1px solid var(--line);border-radius:999px;padding:3px 9px;background:transparent;color:var(--muted);cursor:pointer}
  .chip-btn:hover{color:var(--fg);border-color:var(--line-2)}
  .chip-btn.on{background:rgba(56,189,248,0.08);color:var(--sky);border-color:rgba(56,189,248,0.4)}
  .entry{padding:7px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:80px 1fr auto;gap:10px;align-items:start}
  .entry.fresh{animation:slideIn .4s ease-out}
  @keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .entry .k{color:var(--cyan);font-size:10px;text-transform:lowercase;letter-spacing:0.05em;padding-top:1px}
  .entry .l{color:var(--fg);font-size:12px;word-break:break-word}
  .entry .t{color:var(--muted-2);font-size:10px;font-variant-numeric:tabular-nums}

  ol.plan{padding-left:18px;margin:0} ol.plan li{margin:4px 0;color:var(--fg);font-size:12px} ol.plan li.empty{color:var(--muted)}

  .map-wrap{border:1px solid var(--line);border-radius:10px;background:rgba(8,10,18,0.6);padding:10px;overflow:auto}
  .map-wrap svg{display:block;width:100%;height:auto;max-height:240px}
  .map-node rect{fill:rgba(16,20,30,0.95);stroke:var(--cyan);stroke-width:1}
  .map-node.root rect{stroke:var(--emerald);stroke-width:1.5}
  .map-node.running rect{stroke:var(--emerald)} .map-node.waiting rect{stroke:var(--amber)} .map-node.failed rect{stroke:var(--red)}
  .map-node text{fill:var(--fg);font-size:10px;font-family:inherit}
  .map-edge{stroke:var(--line-2);stroke-width:1;fill:none}

  .row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:12px}
  .row .k{color:var(--muted)} .row .v{color:var(--fg);font-variant-numeric:tabular-nums}
  .files{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}
  .file{color:var(--blue);font-size:11px;padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:inherit}
  .chip{display:inline-block;color:var(--cyan);font-size:10px;border:1px solid var(--line);border-radius:999px;padding:1px 7px;margin:2px 4px 0 0;background:rgba(34,211,238,0.05)}

  .budget .bar{height:8px;border-radius:5px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
  .budget .bar > i{display:block;height:100%;transition:width .3s ease;background:var(--gradient)}
  .budget .bar > i.warn{background:linear-gradient(90deg,var(--cyan),var(--amber))}
  .budget .bar > i.compact{background:linear-gradient(90deg,var(--amber),var(--red))}
  .budget .n{color:var(--muted);font-size:11px;margin-top:6px;font-variant-numeric:tabular-nums}
  .budget-edit{margin-top:10px;font-size:11px;color:var(--muted)}
  .budget-edit summary{cursor:pointer;color:var(--sky);font-size:10px;text-transform:uppercase;letter-spacing:0.12em;padding:4px 0}
  .budget-edit label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
  .budget-edit input{width:130px;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:4px 7px;font:inherit}
  .budget-edit input:focus{outline:none;border-color:var(--sky)}
  .budget-edit button{background:var(--surface);color:var(--sky);border:1px solid var(--sky);border-radius:5px;padding:5px 12px;font:inherit;cursor:pointer;margin-top:6px}
  .budget-edit button:hover{background:rgba(56,189,248,0.1)}

  #msearch{width:100%;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 10px;font:inherit;margin-bottom:8px}
  #msearch:focus{outline:none;border-color:var(--sky)}
  .hit{border:1px solid var(--line);border-radius:9px;padding:8px 10px;margin-bottom:6px;background:rgba(13,17,23,0.6);cursor:pointer;transition:border-color .15s}
  .hit:hover{border-color:var(--sky)}
  .hit .meta{color:var(--muted);font-size:10px;margin-bottom:3px}
  .hit .kind{color:var(--cyan)} .hit .id{color:var(--emerald)}
  .hit .sum{color:var(--fg);font-size:12px}
  .hit .detail{color:var(--muted);font-size:11px;margin-top:7px;white-space:pre-wrap;border-top:1px solid var(--line);padding-top:7px}

  .skill-row{display:grid;grid-template-columns:1fr 60px;gap:8px;align-items:center;padding:4px 0;font-size:11px}
  .skill-row .name{color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .skill-row .bar{height:5px;border-radius:3px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
  .skill-row .bar > i{display:block;height:100%;background:var(--gradient)}
  .skill-row .count{color:var(--muted);font-size:10px;text-align:right;font-variant-numeric:tabular-nums}

  /* PROJECT TAB: HEATMAP */
  .heatmap{
    display:grid;grid-template-columns:repeat(53, 1fr);gap:3px;
    background:rgba(8,10,18,0.4);border-radius:10px;padding:10px;
    border:1px solid var(--line);
  }
  .hm-day{
    aspect-ratio:1;border-radius:2px;background:rgba(26,34,48,0.7);
    cursor:pointer;transition:transform .1s, box-shadow .1s;
  }
  .hm-day:hover{transform:scale(1.4);box-shadow:0 0 0 1px var(--sky)}
  .hm-day.l1{background:rgba(52,211,153,0.25)}
  .hm-day.l2{background:rgba(52,211,153,0.5)}
  .hm-day.l3{background:rgba(34,211,238,0.7)}
  .hm-day.l4{background:rgba(96,165,250,0.9)}
  .hm-day.today{box-shadow:0 0 0 1px var(--emerald)}
  .hm-legend{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);margin-top:8px;justify-content:flex-end}
  .hm-legend .sq{width:10px;height:10px;border-radius:2px;display:inline-block}

  /* FILE LEADERBOARD */
  .lb-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
  .lb-row:last-child{border-bottom:0}
  .lb-row .path{color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
  .lb-row .stats{display:flex;gap:8px;font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
  .lb-row .bar{grid-column:1/-1;height:4px;border-radius:2px;background:var(--surface);border:1px solid var(--line);overflow:hidden;margin-top:6px}
  .lb-row .bar > i{display:block;height:100%;background:var(--gradient-violet)}

  /* LESSONS */
  .lesson-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:10px}
  .lesson{border:1px solid var(--line);border-radius:10px;padding:11px 12px;background:rgba(13,17,23,0.6);transition:border-color .15s}
  .lesson:hover{border-color:var(--violet)}
  .lesson .title{color:var(--violet);font-weight:700;font-size:12px;margin-bottom:5px}
  .lesson .body{color:var(--muted);font-size:11px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
  .lesson .meta{margin-top:7px;font-size:10px;color:var(--muted-2);font-variant-numeric:tabular-nums}

  /* SESSIONS TABLE */
  table.sess{width:100%;border-collapse:collapse;font-size:12px}
  table.sess th{text-align:left;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--line)}
  table.sess td{padding:9px 10px;border-bottom:1px solid var(--line);color:var(--fg)}
  table.sess tr:hover td{background:rgba(56,189,248,0.04)}
  table.sess .id{color:var(--cyan);font-weight:700}
  table.sess .actions{text-align:right;display:flex;gap:4px;justify-content:flex-end}
  table.sess button.act{font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid var(--line);background:rgba(13,17,23,0.6);color:var(--muted);cursor:pointer}
  table.sess button.act:hover{color:var(--fg);border-color:var(--sky)}
  table.sess button.act.danger:hover{color:var(--red);border-color:var(--red)}

  /* DONUT (SVG) */
  .donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .donut{width:160px;height:160px}
  .donut-legend{flex:1;min-width:140px}
  .legend-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:11px}
  .legend-row .sq{width:9px;height:9px;border-radius:2px}
  .legend-row .name{color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .legend-row .pct{color:var(--muted);font-variant-numeric:tabular-nums;font-size:10px}

  /* JOURNAL */
  .journal-nav{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
  .journal-nav .date{font-size:18px;font-weight:700;letter-spacing:-0.01em}
  .journal-nav button.nav-btn{border:1px solid var(--line);border-radius:7px;padding:5px 11px;font-size:11px;color:var(--muted);background:rgba(13,17,23,0.6);cursor:pointer}
  .journal-nav button.nav-btn:hover{border-color:var(--sky);color:var(--fg)}
  .journal-nav input[type=date]{background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:5px 9px;font:inherit;font-size:11px}
  .journal-nav input[type=date]:focus{outline:none;border-color:var(--sky)}

  .day-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px}
  .day-tile{border:1px solid var(--line);border-radius:11px;padding:11px 13px;background:rgba(13,17,23,0.6)}
  .day-tile .lbl{font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:var(--muted);margin-bottom:5px}
  .day-tile .val{font-size:22px;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums}
  .day-tile.alert{border-color:rgba(248,113,113,0.4)}

  /* KIND PILLS color-coded */
  .kpill{display:inline-block;font-size:10px;padding:2px 8px;border-radius:999px;margin:2px 4px 0 0;border:1px solid}
  .kpill[data-k="edit"]{color:var(--emerald);border-color:rgba(52,211,153,0.4);background:rgba(52,211,153,0.06)}
  .kpill[data-k="plan"]{color:var(--violet);border-color:rgba(167,139,250,0.4);background:rgba(167,139,250,0.06)}
  .kpill[data-k="decision"]{color:var(--cyan);border-color:rgba(34,211,238,0.4);background:rgba(34,211,238,0.06)}
  .kpill[data-k="search"]{color:var(--blue);border-color:rgba(96,165,250,0.4);background:rgba(96,165,250,0.06)}
  .kpill[data-k="map"]{color:var(--amber);border-color:rgba(251,191,36,0.4);background:rgba(251,191,36,0.06)}
  .kpill[data-k="error"]{color:var(--red);border-color:rgba(248,113,113,0.4);background:rgba(248,113,113,0.06)}
  .kpill[data-k="run"]{color:var(--indigo);border-color:rgba(129,140,248,0.4);background:rgba(129,140,248,0.06)}

  .empty{color:var(--muted);padding:8px 0;font-size:11px;font-style:italic}
  .note{color:var(--muted-2);font-size:10px;margin-top:8px;line-height:1.5}

  /* INSIGHT BAND */
  .insight-band{
    border:1px solid var(--line);
    background:linear-gradient(180deg, rgba(52,211,153,0.06), rgba(13,17,23,0.7));
    border-left:3px solid var(--emerald);
    border-radius:12px;padding:18px 22px 14px;margin-bottom:16px;
  }
  .ib-label{font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:var(--emerald);font-weight:600;margin-bottom:8px}
  .ib-paragraph{font-size:16px;line-height:1.55;color:var(--fg);margin:0 0 10px}
  .ib-bullets{margin:0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6}
  .ib-bullets:empty{display:none}
  .ib-bullets li{margin:2px 0}

  /* FLOW (said-to-did) */
  .flow-lane{border:1px solid var(--line);border-radius:12px;margin-bottom:14px;background:rgba(13,17,23,0.5);overflow:hidden}
  .flow-said{display:flex;gap:12px;align-items:flex-start;padding:13px 16px;border-left:3px solid var(--sky);background:linear-gradient(180deg,rgba(56,189,248,0.08),transparent)}
  .flow-said .who{font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:var(--sky);font-weight:700;white-space:nowrap;padding-top:3px}
  .flow-said .what{color:var(--fg);font-size:14px;line-height:1.5;flex:1}
  .flow-said .time{color:var(--muted-2);font-size:10px;white-space:nowrap;padding-top:3px;font-variant-numeric:tabular-nums}
  .flow-opening .flow-said{border-left-color:var(--muted-2);background:linear-gradient(180deg,rgba(139,155,180,0.06),transparent)}
  .flow-opening .who{color:var(--muted)}
  .flow-did{padding:8px 16px 13px}
  .flow-summary{color:var(--emerald);font-size:12px;margin:2px 0 10px;font-style:italic}
  .flow-actions{display:flex;flex-direction:column}
  .flow-act{display:grid;grid-template-columns:74px 1fr auto;gap:10px;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(26,34,48,0.55)}
  .flow-act:last-child{border-bottom:0}
  .flow-act .tool{color:var(--cyan);font-size:9px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
  .flow-act .lab{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .flow-act .ag{color:var(--violet);font-size:9px;white-space:nowrap}
  .flow-files{margin-top:9px;border-top:1px solid var(--line);padding-top:9px}

  /* MEMORY OVERVIEW */
  .mem-item{border:1px solid var(--line);border-radius:9px;padding:9px 11px;margin-bottom:7px;background:rgba(13,17,23,0.6)}
  .mem-item .mname{color:var(--emerald);font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mem-item .mexc{color:var(--muted);font-size:11px;line-height:1.5;margin-top:4px;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .mem-item .mmeta{color:var(--muted-2);font-size:9px;margin-top:4px;font-variant-numeric:tabular-nums}

  /* MODAL */
  .modal-bg{position:fixed;inset:0;background:rgba(5,6,10,0.7);backdrop-filter:blur(6px);z-index:50;display:none;align-items:center;justify-content:center;padding:20px}
  .modal-bg.on{display:flex}
  .modal{background:var(--surface-2);border:1px solid var(--line);border-radius:14px;max-width:480px;width:100%;padding:18px 20px}
  .modal h3{margin:0 0 8px;font-size:14px}
  .modal p{margin:0 0 14px;font-size:12px;color:var(--muted)}
  .modal .actions{display:flex;gap:8px;justify-content:flex-end}
  .modal button{border:1px solid var(--line);border-radius:7px;padding:6px 14px;font-size:12px;cursor:pointer;background:rgba(13,17,23,0.6);color:var(--muted)}
  .modal button.go{color:var(--red);border-color:var(--red)}
  .modal button.go:hover{background:rgba(248,113,113,0.1)}

  footer{padding:12px 20px;color:var(--muted-2);font-size:11px;border-top:1px solid var(--line);display:flex;gap:14px;flex-wrap:wrap}
  footer .sep{color:var(--line-2)}

  /* TOAST */
  .toast{position:fixed;bottom:18px;right:18px;background:var(--surface-2);border:1px solid var(--emerald);border-radius:9px;padding:9px 14px;font-size:12px;color:var(--fg);z-index:40;opacity:0;pointer-events:none;transition:opacity .25s}
  .toast.on{opacity:1}
</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="dot"></span>
    <span class="name">slipstream</span>
    <span class="ver" id="ver">v0.6</span>
  </div>
  <span class="conn-pill" title="Active session, click select to switch">
    <span class="conn-dot" id="conn-dot"></span>
    <select id="sessions-sel" aria-label="Active session"></select>
  </span>
  <span class="conn-pill" id="clock-pill" title="Session uptime">
    <span class="conn-dot live"></span>
    <span id="clock" style="font-variant-numeric:tabular-nums">00:00</span>
  </span>
  <div class="spacer"></div>
  <button class="control" id="refresh-btn" title="Refresh project data">refresh</button>
  <button class="control" id="pause-btn" title="Pause or resume the live stream"><span id="pause-label">pause</span></button>
  <button class="control" id="copy-btn" title="Copy the current session id"><span>copy id</span></button>
  <a class="control" href="https://github.com/sarmakska/slipstream" target="_blank" rel="noopener" title="Open on GitHub"><span>github</span></a>
</header>

<nav class="tabs" id="tabs">
  <button class="tab on" data-tab="live">Live</button>
  <button class="tab" data-tab="flow">Flow</button>
  <button class="tab" data-tab="project">Project <span class="badge" id="tb-obs">0</span></button>
  <button class="tab" data-tab="journal">Journal</button>
  <button class="tab" data-tab="sessions">Sessions <span class="badge" id="tb-sess">0</span></button>
  <button class="tab" data-tab="memory">Memory</button>
</nav>

<!-- LIVE -->
<div class="view on" id="view-live">
  <section class="insight-band">
    <div class="ib-label">Insights</div>
    <p class="ib-paragraph" id="ib-live-p">Reading the session...</p>
    <ul class="ib-bullets" id="ib-live-b"></ul>
  </section>
  <div class="kpis">
    <div class="kpi" id="kpi-ctx"><div class="lbl">context</div><div class="val" id="kpi-ctx-val">0%</div><div class="sub" id="kpi-ctx-sub">0 / 200k tokens</div><svg class="spark" id="kpi-ctx-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
    <div class="kpi" id="kpi-opt"><div class="lbl">optimised</div><div class="val" id="kpi-opt-val">0%</div><div class="sub" id="kpi-opt-sub">scoped vs whole-file</div><svg class="spark" id="kpi-opt-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
    <div class="kpi" id="kpi-mem"><div class="lbl">observations</div><div class="val" id="kpi-mem-val">0</div><div class="sub" id="kpi-mem-sub">this project</div><svg class="spark" id="kpi-mem-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
    <div class="kpi" id="kpi-tools"><div class="lbl">tool calls</div><div class="val" id="kpi-tools-val">0</div><div class="sub" id="kpi-tools-sub">this session</div><svg class="spark" id="kpi-tools-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
    <div class="kpi" id="kpi-files"><div class="lbl">files touched</div><div class="val" id="kpi-files-val">0</div><div class="sub" id="kpi-files-sub">unique paths</div><svg class="spark" id="kpi-files-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
    <div class="kpi" id="kpi-agents"><div class="lbl">agents</div><div class="val" id="kpi-agents-val">0</div><div class="sub" id="kpi-agents-sub">running / total</div><svg class="spark" id="kpi-agents-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg></div>
  </div>
  <div class="grid-3">
    <div class="grid-stack">
      <div class="panel"><h2>Agents <span class="badge" id="agents-count">0</span></h2><div id="agents"><div class="empty">waiting for the session to start</div></div></div>
      <div class="panel budget">
        <h2>Token budget</h2>
        <div class="bar"><i id="bbar" style="width:0%"></i></div>
        <div class="n" id="bnum">0 of 200000 tokens</div>
        <details class="budget-edit">
          <summary>set budget</summary>
          <label>target <input id="btarget" type="number" min="1000" step="1000" /></label>
          <label>warn % <input id="bwarn" type="number" min="1" max="99" /></label>
          <label>compact % <input id="bcompact" type="number" min="1" max="100" /></label>
          <label>actual tokens <input id="bactual" type="number" min="0" placeholder="paste from editor" /></label>
          <button id="bsave" type="button">save</button>
        </details>
        <div class="note">True context tokens when the host transcript is wired in; otherwise an estimate of bytes slipstream pulled.</div>
      </div>
      <div class="panel"><h2>Per-skill activity</h2><div id="skills"><div class="empty">no tool calls yet</div></div></div>
    </div>
    <div class="grid-stack">
      <div class="panel">
        <h2>Activity <span id="who" style="color:var(--sky);font-weight:400;text-transform:none;letter-spacing:0">/</span></h2>
        <div class="filter-row" id="filters"></div>
        <div id="stream"><div class="empty">no activity yet</div></div>
      </div>
    </div>
    <div class="grid-stack">
      <div class="panel"><h2>Plan</h2><ol class="plan" id="plan"><li class="empty">no plan posted</li></ol></div>
      <div class="panel"><h2>Mind map</h2><div class="map-wrap"><svg id="map" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet"></svg></div></div>
      <div class="panel"><h2>Session work</h2><div id="work"><div class="empty">no work yet</div></div></div>
    </div>
  </div>
</div>

<!-- FLOW -->
<div class="view" id="view-flow">
  <div class="panel">
    <h2>Conversation flow <span class="badge" id="flow-count">0</span></h2>
    <div class="note" style="margin-top:0;margin-bottom:12px">What you said, and what the agent did about it. One lane per prompt, read top to bottom as the story of this session.</div>
    <div id="flow"><div class="empty">no conversation yet for this session</div></div>
  </div>
</div>

<!-- PROJECT -->
<div class="view" id="view-project">
  <section class="insight-band">
    <div class="ib-label">Insights</div>
    <p class="ib-paragraph" id="ib-project-p">Reading the project...</p>
    <ul class="ib-bullets" id="ib-project-b"></ul>
  </section>
  <div class="kpis" id="proj-kpis">
    <div class="kpi"><div class="lbl">sessions</div><div class="val" id="p-sess">0</div><div class="sub">total recorded</div></div>
    <div class="kpi"><div class="lbl">observations</div><div class="val" id="p-obs">0</div><div class="sub" id="p-obs-sub">across project</div></div>
    <div class="kpi"><div class="lbl">files</div><div class="val" id="p-files">0</div><div class="sub">unique paths</div></div>
    <div class="kpi"><div class="lbl">optimised</div><div class="val" id="p-opt">0%</div><div class="sub" id="p-opt-sub">scoped vs whole</div></div>
    <div class="kpi"><div class="lbl">memories</div><div class="val" id="p-mem">0</div><div class="sub">durable</div></div>
    <div class="kpi" id="p-drift-kpi"><div class="lbl">drift flags</div><div class="val" id="p-drift">0</div><div class="sub">to review</div></div>
  </div>
  <div class="panel" style="margin-bottom:14px">
    <h2>Activity heatmap <span class="badge" id="hm-window">last 90 days</span></h2>
    <div class="heatmap" id="heatmap"></div>
    <div class="hm-legend">
      <span>less</span>
      <span class="sq" style="background:rgba(26,34,48,0.7)"></span>
      <span class="sq" style="background:rgba(52,211,153,0.25)"></span>
      <span class="sq" style="background:rgba(52,211,153,0.5)"></span>
      <span class="sq" style="background:rgba(34,211,238,0.7)"></span>
      <span class="sq" style="background:rgba(96,165,250,0.9)"></span>
      <span>more</span>
      <span style="margin-left:14px">click a day for its journal</span>
    </div>
  </div>
  <div class="grid-2">
    <div class="panel">
      <h2>File leaderboard <span class="badge" id="lb-count">0</span></h2>
      <div id="leaderboard"><div class="empty">no files touched yet</div></div>
    </div>
    <div class="panel">
      <h2>Observations by kind</h2>
      <div class="donut-wrap">
        <svg class="donut" id="donut-kinds" viewBox="-90 -90 180 180"></svg>
        <div class="donut-legend" id="donut-kinds-legend"></div>
      </div>
    </div>
  </div>
  <div class="panel" style="margin-top:14px">
    <h2>Distilled lessons <span class="badge" id="lessons-count">0</span></h2>
    <div class="lesson-grid" id="lessons-grid"><div class="empty">collecting lessons; appears once topics recur across sessions</div></div>
  </div>
</div>

<!-- JOURNAL -->
<div class="view" id="view-journal">
  <section class="insight-band">
    <div class="ib-label">Insights</div>
    <p class="ib-paragraph" id="ib-journal-p">Reading the day...</p>
    <ul class="ib-bullets" id="ib-journal-b"></ul>
  </section>
  <div class="journal-nav">
    <button class="nav-btn" id="day-prev">&lt;&lt; prev</button>
    <input type="date" id="day-pick" />
    <button class="nav-btn" id="day-next">next &gt;&gt;</button>
    <button class="nav-btn" id="day-today">today</button>
    <div class="date" id="day-title"></div>
  </div>
  <div class="day-tiles" id="day-tiles"></div>
  <div class="grid-2">
    <div class="panel">
      <h2>Top files this day</h2>
      <div id="day-files"><div class="empty">no activity on this day</div></div>
    </div>
    <div class="panel">
      <h2>Tools used</h2>
      <div id="day-tools"><div class="empty">no tool calls on this day</div></div>
    </div>
  </div>
  <div class="panel" style="margin-top:14px">
    <h2>Sessions on this day</h2>
    <div id="day-sessions"><div class="empty">no sessions on this day</div></div>
  </div>
</div>

<!-- SESSIONS -->
<div class="view" id="view-sessions">
  <section class="insight-band">
    <div class="ib-label">Insights</div>
    <p class="ib-paragraph" id="ib-sessions-p">Reading sessions...</p>
    <ul class="ib-bullets" id="ib-sessions-b"></ul>
  </section>
  <div class="panel">
    <h2>All sessions <span class="badge" id="all-sess-count">0</span></h2>
    <table class="sess">
      <thead><tr><th>id</th><th>status</th><th>actions</th></tr></thead>
      <tbody id="sessions-tbody"></tbody>
    </table>
    <div class="note">Deleting a session removes its event log and observation file. The action is destructive and cannot be undone from the dashboard.</div>
  </div>
</div>

<!-- MEMORY -->
<div class="view" id="view-memory">
  <div class="panel" style="margin-bottom:14px">
    <h2>Memory that survives <span class="badge" id="mem-ov-count">0</span></h2>
    <p class="ib-paragraph" id="mem-summary" style="font-size:14px">Reading memory...</p>
    <div class="grid-2">
      <div>
        <div class="ib-label">Session digests, survive a compact</div>
        <div id="mem-digests"><div class="empty">no digests yet</div></div>
      </div>
      <div>
        <div class="ib-label">Durable facts via sp_remember</div>
        <div id="mem-durable"><div class="empty">no durable memories yet</div></div>
      </div>
    </div>
    <div class="ib-label" style="margin-top:14px">Lessons learned across sessions</div>
    <div id="mem-lessons"><div class="empty">collecting lessons; they appear once topics recur</div></div>
    <div class="note">This is what the next session reloads after a lost or compacted session. Readable by you here and by Claude Code on the next start.</div>
  </div>
  <div class="panel">
    <h2>Memory search</h2>
    <input id="msearch" type="search" placeholder="search every observation in this project..." autocomplete="off" />
    <div class="filter-row" id="msearch-filters">
      <button class="chip-btn on" data-kind="">all kinds</button>
      <button class="chip-btn" data-kind="edit">edit</button>
      <button class="chip-btn" data-kind="plan">plan</button>
      <button class="chip-btn" data-kind="decision">decision</button>
      <button class="chip-btn" data-kind="search">search</button>
      <button class="chip-btn" data-kind="map">map</button>
      <button class="chip-btn" data-kind="error">error</button>
      <button class="chip-btn" data-kind="run">run</button>
    </div>
    <div id="mhits"><div class="empty">type to search this project's memory across every session</div></div>
    <div class="note">Local bind only. No telemetry. The dashboard never phones home.</div>
  </div>
</div>

<div class="modal-bg" id="modal-bg">
  <div class="modal">
    <h3 id="modal-title">Confirm</h3>
    <p id="modal-body">Are you sure?</p>
    <div class="actions">
      <button id="modal-cancel">cancel</button>
      <button id="modal-go" class="go">delete</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<footer>
  <span>SarmaLinux</span>
  <span class="sep">/</span>
  <a href="https://sarmalinux.com">sarmalinux.com</a>
  <span class="sep">/</span>
  <a href="https://github.com/sarmakska/slipstream">github.com/sarmakska/slipstream</a>
  <span class="sep">/</span>
  <span>bound 127.0.0.1, offline-safe</span>
</footer>

<script type="module">
  const escape = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const $ = (id) => document.getElementById(id);
  const formatNum = (n) => n == null ? "0" : Number(n).toLocaleString("en-GB");
  const formatShort = (n) => n == null ? "0" : (n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? Math.round(n/1e3)+"k" : String(n));
  const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 1800); };

  // INSIGHT BAND: render {paragraph, bullets} into a tab's band.
  function renderInsight(prefix, ins) {
    const p = $(prefix + "-p"), b = $(prefix + "-b");
    if (!p || !b) return;
    if (!ins || !ins.paragraph) { b.innerHTML = ""; return; }
    p.textContent = ins.paragraph;
    b.innerHTML = (ins.bullets || []).map((x) => '<li>' + escape(x) + '</li>').join("");
  }
  async function loadInsight(tab, prefix, qs) {
    const ins = await fetch("/api/insights/" + tab + (qs || "")).then((r) => r.json()).catch(() => null);
    renderInsight(prefix, ins);
  }
  function loadLiveInsight() { return loadInsight("live", "ib-live", "?session=" + encodeURIComponent(current)); }

  let current = ${JSON.stringify(session)};
  let selected = null;
  let state = null;
  let es = null;
  let paused = false;
  let currentTab = "live";
  let currentDate = new Date().toISOString().slice(0, 10);
  let msearchKind = "";
  const startedAtRef = { t: Date.now() };
  const sparkHistory = { ctx: [], opt: [], mem: [], tools: [], files: [], agents: [] };
  const filterState = { kind: null };
  const seenEntryIds = new Set();
  const KIND_COLORS = { edit:"#34d399", plan:"#a78bfa", decision:"#22d3ee", search:"#60a5fa", map:"#fbbf24", error:"#f87171", run:"#818cf8", other:"#5b6478" };

  // TAB NAV
  for (const t of document.querySelectorAll(".tab")) {
    t.addEventListener("click", () => {
      const target = t.dataset.tab;
      currentTab = target;
      for (const x of document.querySelectorAll(".tab")) x.classList.toggle("on", x.dataset.tab === target);
      for (const v of document.querySelectorAll(".view")) v.classList.toggle("on", v.id === "view-" + target);
      if (target === "flow") loadFlow();
      if (target === "memory") loadMemoryOverview();
      if (target === "project") loadProject();
      if (target === "journal") loadJournal(currentDate);
      if (target === "sessions") loadSessionsTable();
    });
  }

  // MEMORY TAB: what survives a lost session, readable by you and by Claude.
  async function loadMemoryOverview() {
    const r = await fetch("/api/memory/overview").then((x) => x.json()).catch(() => null);
    if (!r) return;
    if (r.summary && r.summary.paragraph) $("mem-summary").textContent = r.summary.paragraph;
    $("mem-ov-count").textContent = (r.counts && r.counts.memories ? r.counts.memories : 0) + " memories";
    const card = (name, body, meta) => '<div class="mem-item"><div class="mname">' + escape(name) + '</div>' + (body ? '<div class="mexc">' + escape(body) + '</div>' : '') + (meta ? '<div class="mmeta">' + escape(meta) + '</div>' : '') + '</div>';
    const dg = $("mem-digests");
    dg.innerHTML = (r.digests && r.digests.length)
      ? r.digests.map((d) => card(d.session, d.excerpt || "", d.updated ? new Date(d.updated).toLocaleString() : "")).join("")
      : '<div class="empty">no digests yet</div>';
    const du = $("mem-durable");
    du.innerHTML = (r.durable && r.durable.length)
      ? r.durable.map((m) => card(m.name, m.description || "", m.updated ? new Date(m.updated).toLocaleDateString() : "")).join("")
      : '<div class="empty">no durable memories yet</div>';
    const ls = $("mem-lessons");
    ls.innerHTML = (r.lessons && r.lessons.length)
      ? r.lessons.map((l) => card(l.title || l.topic || "lesson", l.summary || l.body || "", l.count ? l.count + " observations" : "")).join("")
      : '<div class="empty">collecting lessons; they appear once topics recur</div>';
  }

  // FLOW TAB: the said-to-did story for the current session.
  async function loadFlow() {
    const s = await fetch("/api/story?session=" + encodeURIComponent(current)).then((r) => r.json()).catch(() => null);
    const box = $("flow");
    if (!s || !s.lanes || s.lanes.length === 0) {
      box.innerHTML = '<div class="empty">no conversation yet for this session</div>';
      $("flow-count").textContent = "0";
      return;
    }
    $("flow-count").textContent = s.promptCount + " prompt" + (s.promptCount === 1 ? "" : "s") + " . " + s.toolCount + " action" + (s.toolCount === 1 ? "" : "s");
    box.innerHTML = "";
    for (const lane of s.lanes) {
      const el = document.createElement("div");
      el.className = "flow-lane" + (lane.opening ? " flow-opening" : "");
      const t = lane.ts ? new Date(lane.ts).toLocaleTimeString([], { hour12: false }) : "";
      const who = lane.opening ? "start" : "you said";
      const said = lane.opening ? "Session opened" : escape(lane.prompt);
      let actions = "";
      for (const a of (lane.actions || [])) {
        const ag = a.agent && a.agent !== "main" ? '<span class="ag">' + escape(a.agent) + '</span>' : '<span></span>';
        actions += '<div class="flow-act"><span class="tool">' + escape(a.tool || a.kind) + '</span><span class="lab" title="' + escape(a.label) + '">' + escape(a.label) + '</span>' + ag + '</div>';
      }
      const files = (lane.files || []).map((f) => '<span class="chip">' + escape(f.split("/").slice(-2).join("/")) + '</span>').join("");
      el.innerHTML =
        '<div class="flow-said"><span class="who">' + who + '</span><span class="what">' + said + '</span><span class="time">' + t + '</span></div>' +
        '<div class="flow-did"><div class="flow-summary">' + escape(lane.summary) + '</div>' +
        (actions ? '<div class="flow-actions">' + actions + '</div>' : '<div class="empty">no actions yet</div>') +
        (files ? '<div class="flow-files">' + files + '</div>' : '') +
        '</div>';
      box.appendChild(el);
    }
  }

  async function loadSessions() {
    const r = await fetch("/api/sessions").then((x) => x.json()).catch(() => ({sessions:[]}));
    const sel = $("sessions-sel"); sel.innerHTML = "";
    for (const s of r.sessions) {
      const o = document.createElement("option");
      o.value = s; o.textContent = s.slice(0, 22) + (s.length > 22 ? "..." : "");
      if (s === current) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { current = sel.value; connect(); };
    $("tb-sess").textContent = String(r.sessions.length);
  }

  function pushSpark(key, val, max = 40) { sparkHistory[key].push(val); if (sparkHistory[key].length > max) sparkHistory[key].shift(); }
  function drawSpark(svgId, data, color) {
    const svg = $(svgId); if (!svg) return; svg.innerHTML = "";
    if (data.length < 2) return;
    const w = 64, h = 22;
    const min = Math.min(...data, 0), max = Math.max(...data, 1);
    const range = max - min || 1;
    const pts = data.map((v, i) => ((i / (data.length - 1)) * w) + "," + (h - ((v - min) / range) * (h - 2) - 1)).join(" ");
    const ns = "http://www.w3.org/2000/svg";
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", pts); poly.setAttribute("fill", "none"); poly.setAttribute("stroke", color);
    poly.setAttribute("stroke-width", "1.4"); poly.setAttribute("stroke-linejoin", "round"); poly.setAttribute("stroke-linecap", "round");
    svg.appendChild(poly);
  }
  function flash(id) { const el = $(id); if (!el) return; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }

  // LIVE RENDERERS (kept from v0.6 redesign)
  function renderAgents() {
    const box = $("agents");
    if (!state || state.agents.length === 0) { box.innerHTML = '<div class="empty">waiting for the session to start</div>'; $("agents-count").textContent = "0"; return; }
    $("agents-count").textContent = String(state.agents.length);
    if (!selected) selected = state.agents[0].id;
    box.innerHTML = "";
    for (const a of state.agents) {
      const d = document.createElement("div");
      d.className = "agent" + (a.id === selected ? " sel" : "");
      d.innerHTML = '<span class="status ' + a.status + '">' + escape(a.status) + '</span><div class="name">' + escape(a.id) + '</div><div class="task">' + escape(a.task || '') + '</div>';
      d.onclick = () => { selected = a.id; renderLive(); };
      box.appendChild(d);
    }
  }
  function renderFilters() {
    if (!state) return;
    const a = state.agents.find((x) => x.id === selected);
    if (!a) { $("filters").innerHTML = ""; return; }
    const kinds = new Set(a.activity.map((e) => e.kind));
    const row = $("filters"); row.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "chip-btn" + (filterState.kind === null ? " on" : ""); allBtn.textContent = "all";
    allBtn.onclick = () => { filterState.kind = null; renderStream(); renderFilters(); };
    row.appendChild(allBtn);
    for (const k of kinds) {
      const b = document.createElement("button");
      b.className = "chip-btn" + (filterState.kind === k ? " on" : ""); b.textContent = k;
      b.onclick = () => { filterState.kind = k; renderStream(); renderFilters(); };
      row.appendChild(b);
    }
  }
  function renderStream() {
    const box = $("stream");
    const a = state && state.agents.find((x) => x.id === selected);
    $("who").textContent = selected ? "/ " + selected : "/";
    if (!a || a.activity.length === 0) { box.innerHTML = '<div class="empty">no activity yet</div>'; return; }
    const filtered = filterState.kind ? a.activity.filter((e) => e.kind === filterState.kind) : a.activity;
    if (filtered.length === 0) { box.innerHTML = '<div class="empty">nothing matches the current filter</div>'; return; }
    box.innerHTML = "";
    const newSet = new Set();
    for (const e of filtered.slice().reverse()) {
      const id = a.id + ':' + e.seq; newSet.add(id);
      const d = document.createElement("div");
      d.className = "entry" + (!seenEntryIds.has(id) ? " fresh" : "");
      const t = e.ts ? new Date(e.ts).toLocaleTimeString([], {hour12:false}) : "";
      d.innerHTML = '<span class="k">' + escape(e.kind) + '</span><span class="l">' + escape(e.label) + '</span><span class="t">' + escape(t) + '</span>';
      box.appendChild(d);
    }
    for (const id of newSet) seenEntryIds.add(id);
  }
  let budgetCfg = null;
  async function loadBudget() {
    const r = await fetch("/api/budget?session=" + encodeURIComponent(current)).then((x) => x.json()).catch(() => null);
    if (!r) return;
    budgetCfg = r.config;
    const pct = Math.min(100, Math.round((r.fraction || 0) * 100));
    const bar = $("bbar"); bar.style.width = pct + "%";
    bar.className = r.level === "compact" ? "compact" : r.level === "warn" ? "warn" : "";
    $("bnum").textContent = formatNum(r.served) + " of " + formatNum(r.config.targetTokens) + " tokens (" + pct + "%, " + r.level + ", " + (r.source || "estimated") + ")";
    $("kpi-ctx-val").textContent = pct + "%";
    $("kpi-ctx-sub").textContent = formatNum(r.served) + " / " + formatShort(r.config.targetTokens) + " tokens";
    const kctx = $("kpi-ctx"); kctx.classList.toggle("warn", r.level === "warn"); kctx.classList.toggle("compact", r.level === "compact");
    pushSpark("ctx", pct); drawSpark("kpi-ctx-spark", sparkHistory.ctx, r.level === "compact" ? "#f87171" : r.level === "warn" ? "#fbbf24" : "#34d399");
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if ($("btarget")) $("btarget").value = r.config.targetTokens;
    if ($("bwarn")) $("bwarn").value = r.config.warnPct;
    if ($("bcompact")) $("bcompact").value = r.config.compactPct;
    if ($("bactual") && r.config.actualTokens != null) $("bactual").value = r.config.actualTokens;
  }
  const bsave = $("bsave");
  if (bsave) bsave.onclick = async () => {
    const body = { targetTokens: Number($("btarget").value) || undefined, warnPct: Number($("bwarn").value) || undefined, compactPct: Number($("bcompact").value) || undefined };
    const a = Number($("bactual").value); if (a > 0) body.actualTokens = a;
    await fetch("/api/budget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    loadBudget(); toast("budget saved");
  };
  function renderPlan() {
    const ol = $("plan");
    if (!state || state.plan.length === 0) { ol.innerHTML = '<li class="empty">no plan posted</li>'; return; }
    ol.innerHTML = "";
    for (const p of state.plan) { const li = document.createElement("li"); li.textContent = p; ol.appendChild(li); }
  }
  function renderMap() {
    if (!state) return; const svg = $("map"); if (!svg) return; svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const sid = (state.session || "session").slice(0, 8);
    const agents = state.agents || [];
    const W = 360, H = Math.max(60, 40 + agents.length * 32);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const rootX = 16, rootY = H / 2 - 12, rootW = 80, rootH = 24;
    drawNode(svg, ns, rootX, rootY, rootW, rootH, sid, "root");
    if (agents.length === 0) { const g = document.createElementNS(ns, "g"); g.setAttribute("class", "map-node"); const t = document.createElementNS(ns, "text"); t.setAttribute("x", rootX + rootW + 20); t.setAttribute("y", H / 2); t.textContent = "waiting..."; g.appendChild(t); svg.appendChild(g); return; }
    const childX = 160, childW = 180, childH = 22;
    const step = Math.min(32, (H - 24) / agents.length);
    agents.forEach((a, i) => {
      const y = 14 + i * step;
      const path = document.createElementNS(ns, "path"); path.setAttribute("class", "map-edge");
      const x1 = rootX + rootW, y1 = rootY + rootH / 2, x2 = childX, y2 = y + childH / 2, mx = (x1 + x2) / 2;
      path.setAttribute("d", "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2);
      svg.appendChild(path);
      drawNode(svg, ns, childX, y, childW, childH, (a.id + ": " + a.status).slice(0, 28), a.status);
    });
  }
  function drawNode(svg, ns, x, y, w, h, label, kind) {
    const g = document.createElementNS(ns, "g"); g.setAttribute("class", "map-node " + (kind || ""));
    const r = document.createElementNS(ns, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h); r.setAttribute("rx", 6); r.setAttribute("ry", 6); g.appendChild(r);
    const t = document.createElementNS(ns, "text"); t.setAttribute("x", x + w / 2); t.setAttribute("y", y + h / 2 + 3); t.setAttribute("text-anchor", "middle"); t.textContent = label; g.appendChild(t);
    svg.appendChild(g);
  }
  function renderWork() {
    const box = $("work");
    if (!state || state.agents.length === 0) { box.innerHTML = '<div class="empty">no work yet</div>'; return; }
    const tools = {}; const files = new Map(); const skillCounts = new Map();
    let toolCalls = 0;
    const tokens = state.agents.reduce((s,a)=>s+a.approxTokens,0);
    for (const a of state.agents) {
      for (const e of a.activity) {
        if (e.kind !== "post-tool" && e.kind !== "pre-tool") continue;
        const parts = String(e.label).split(/\\s+/); const tool = parts[0] || "";
        if (!tool) continue;
        if (e.kind === "post-tool") { tools[tool] = (tools[tool]||0)+1; toolCalls++; skillCounts.set(tool, (skillCounts.get(tool)||0)+1); }
        const target = parts.slice(1).join(" ");
        if (target && /[\\\\/.]/.test(target)) files.set(target, (files.get(target)||0)+1);
      }
    }
    const chips = Object.entries(tools).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t,n])=>'<span class="chip">'+escape(t)+(n>1?" x"+n:"")+'</span>').join("");
    const fileList = [...files.keys()].slice(0,12).map(f=>'<div class="file" title="'+escape(f)+'">'+escape(f)+'</div>').join("");
    box.innerHTML = '<div class="row"><span class="k">tokens pulled</span><span class="v">'+formatNum(tokens)+'</span></div><div class="row"><span class="k">tool calls</span><span class="v">'+toolCalls+'</span></div><div class="row"><span class="k">files touched</span><span class="v">'+files.size+'</span></div><div class="row"><span class="k">optimised</span><span class="v" id="optv">...</span></div>' + (chips ? '<div style="margin-top:6px">'+chips+'</div>' : '') + (fileList ? '<div class="files">'+fileList+'</div>' : '');
    const prevTools = sparkHistory.tools[sparkHistory.tools.length - 1] ?? 0;
    if (toolCalls > prevTools) flash("kpi-tools");
    $("kpi-tools-val").textContent = formatNum(toolCalls); pushSpark("tools", toolCalls); drawSpark("kpi-tools-spark", sparkHistory.tools, "#22d3ee");
    $("kpi-files-val").textContent = formatNum(files.size); pushSpark("files", files.size); drawSpark("kpi-files-spark", sparkHistory.files, "#60a5fa");
    const running = state.agents.filter((a) => a.status === "running").length;
    $("kpi-agents-val").textContent = running + "/" + state.agents.length; pushSpark("agents", state.agents.length); drawSpark("kpi-agents-spark", sparkHistory.agents, "#a78bfa");
    renderSkills(skillCounts); loadSavings();
  }
  function renderSkills(counts) {
    const box = $("skills");
    if (counts.size === 0) { box.innerHTML = '<div class="empty">no tool calls yet</div>'; return; }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted[0][1] || 1; box.innerHTML = "";
    for (const [name, n] of sorted) {
      const row = document.createElement("div"); row.className = "skill-row";
      const pct = Math.round((n / max) * 100);
      row.innerHTML = '<div><div class="name">' + escape(name) + '</div><div class="bar"><i style="width:' + pct + '%"></i></div></div><div class="count">' + n + '</div>';
      box.appendChild(row);
    }
  }
  async function loadSavings() {
    const s = await fetch("/api/savings").then((x) => x.json()).catch(() => null);
    const el = $("optv");
    if (el) el.textContent = s && s.scopedReads ? "saved ~" + formatNum(s.savedTokens) + " tok (" + s.pct + "%, " + s.scopedReads + " reads)" : "no scoped reads yet";
    if (s && s.scopedReads) { $("kpi-opt-val").textContent = s.pct + "%"; $("kpi-opt-sub").textContent = formatNum(s.savedTokens) + " tokens saved"; pushSpark("opt", s.pct); drawSpark("kpi-opt-spark", sparkHistory.opt, "#34d399"); }
  }
  function renderMemKpi() {
    if (!state) return;
    const n = state.observationCount ?? state.observations?.length ?? 0;
    $("kpi-mem-val").textContent = formatNum(n); pushSpark("mem", n); drawSpark("kpi-mem-spark", sparkHistory.mem, "#a78bfa");
  }
  function renderLive() { renderAgents(); renderFilters(); renderStream(); loadBudget(); renderPlan(); renderMap(); renderWork(); renderMemKpi(); loadLiveInsight(); }

  // PROJECT TAB
  async function loadProject() {
    loadInsight("project", "ib-project");
    const s = await fetch("/api/project/summary").then(r => r.json()).catch(() => null);
    if (!s) return;
    $("p-sess").textContent = formatNum(s.sessions);
    $("p-obs").textContent = formatNum(s.observations);
    $("p-obs-sub").textContent = s.lastActivity ? "last " + new Date(s.lastActivity).toLocaleDateString() : "no activity yet";
    $("p-files").textContent = formatNum(s.uniqueFiles);
    $("p-opt").textContent = (s.optPct || 0) + "%";
    $("p-opt-sub").textContent = formatNum(s.savedTokens) + " tokens";
    $("p-mem").textContent = formatNum(s.memories);
    $("p-drift").textContent = formatNum(s.driftCount);
    $("p-drift-kpi").classList.toggle("compact", s.driftCount > 0);
    $("tb-obs").textContent = formatNum(s.observations);
    drawHeatmap();
    drawLeaderboard();
    drawKindsDonut(s.kinds || {});
    drawLessons();
  }
  async function drawHeatmap() {
    const r = await fetch("/api/project/heatmap?days=365").then(x => x.json()).catch(() => null);
    if (!r) return;
    const box = $("heatmap"); box.innerHTML = "";
    const today = new Date().toISOString().slice(0, 10);
    const max = Math.max(1, ...r.entries.map(e => e.count));
    for (const e of r.entries) {
      const d = document.createElement("div");
      let level = 0;
      if (e.count > 0) level = e.count >= max * 0.75 ? 4 : e.count >= max * 0.5 ? 3 : e.count >= max * 0.25 ? 2 : 1;
      d.className = "hm-day" + (level ? " l" + level : "") + (e.date === today ? " today" : "");
      d.title = e.date + ": " + e.count + " observation" + (e.count === 1 ? "" : "s");
      d.onclick = () => { currentDate = e.date; for (const x of document.querySelectorAll(".tab")) x.classList.toggle("on", x.dataset.tab === "journal"); for (const v of document.querySelectorAll(".view")) v.classList.toggle("on", v.id === "view-journal"); currentTab = "journal"; loadJournal(e.date); };
      box.appendChild(d);
    }
    $("hm-window").textContent = "last " + r.days + " days";
  }
  async function drawLeaderboard() {
    const r = await fetch("/api/project/files?limit=20").then(x => x.json()).catch(() => null);
    if (!r) return;
    const box = $("leaderboard");
    if (!r.files || r.files.length === 0) { box.innerHTML = '<div class="empty">no files touched yet</div>'; return; }
    $("lb-count").textContent = String(r.files.length);
    const max = r.files[0].touches || 1;
    box.innerHTML = "";
    for (const f of r.files) {
      const row = document.createElement("div"); row.className = "lb-row";
      const pct = Math.round((f.touches / max) * 100);
      const lastDate = f.last ? new Date(f.last).toLocaleDateString() : "";
      row.innerHTML = '<div class="path" title="' + escape(f.path) + '">' + escape(f.path) + '</div>' +
        '<div class="stats">' + f.touches + ' touch' + (f.touches === 1 ? '' : 'es') + ' . ' + f.sessions + ' sess . ' + escape(lastDate) + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      box.appendChild(row);
    }
  }
  function drawKindsDonut(kinds) {
    const svg = $("donut-kinds"); svg.innerHTML = "";
    const legend = $("donut-kinds-legend"); legend.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const entries = Object.entries(kinds).filter(([,v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) { svg.innerHTML = '<text x="0" y="6" text-anchor="middle" fill="#5b6478" font-size="12">no observations yet</text>'; return; }
    const total = entries.reduce((s, [,v]) => s + v, 0);
    let start = -Math.PI / 2;
    const R = 70, R2 = 45;
    for (const [k, v] of entries) {
      const slice = (v / total) * Math.PI * 2;
      const end = start + slice;
      const large = slice > Math.PI ? 1 : 0;
      const x1 = R * Math.cos(start), y1 = R * Math.sin(start);
      const x2 = R * Math.cos(end), y2 = R * Math.sin(end);
      const xi1 = R2 * Math.cos(start), yi1 = R2 * Math.sin(start);
      const xi2 = R2 * Math.cos(end), yi2 = R2 * Math.sin(end);
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M " + x1 + " " + y1 + " A " + R + " " + R + " 0 " + large + " 1 " + x2 + " " + y2 + " L " + xi2 + " " + yi2 + " A " + R2 + " " + R2 + " 0 " + large + " 0 " + xi1 + " " + yi1 + " Z");
      path.setAttribute("fill", KIND_COLORS[k] || KIND_COLORS.other);
      path.setAttribute("opacity", "0.85");
      svg.appendChild(path);
      start = end;
      const lr = document.createElement("div"); lr.className = "legend-row";
      lr.innerHTML = '<span class="sq" style="background:' + (KIND_COLORS[k] || KIND_COLORS.other) + '"></span>' +
        '<span class="name">' + escape(k) + '</span>' +
        '<span class="pct">' + v + ' . ' + ((v / total) * 100).toFixed(0) + '%</span>';
      legend.appendChild(lr);
    }
    const t = document.createElementNS(ns, "text"); t.setAttribute("x", 0); t.setAttribute("y", 0); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "#f5f7fa"); t.setAttribute("font-size", "18"); t.setAttribute("font-weight", "700"); t.setAttribute("dy", "-2"); t.textContent = formatShort(total); svg.appendChild(t);
    const t2 = document.createElementNS(ns, "text"); t2.setAttribute("x", 0); t2.setAttribute("y", 0); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("fill", "#8b9bb4"); t2.setAttribute("font-size", "9"); t2.setAttribute("dy", "12"); t2.textContent = "total"; svg.appendChild(t2);
  }
  async function drawLessons() {
    const r = await fetch("/api/project/lessons?limit=12").then(x => x.json()).catch(() => null);
    const box = $("lessons-grid");
    if (!r || !r.lessons || r.lessons.length === 0) { box.innerHTML = '<div class="empty">collecting lessons; appears once topics recur across sessions</div>'; $("lessons-count").textContent = "0"; return; }
    $("lessons-count").textContent = String(r.lessons.length);
    box.innerHTML = "";
    for (const l of r.lessons) {
      const d = document.createElement("div"); d.className = "lesson";
      d.innerHTML = '<div class="title">' + escape(l.title || l.topic || 'lesson') + '</div>' +
        '<div class="body">' + escape(l.summary || l.body || '') + '</div>' +
        '<div class="meta">' + (l.count ? l.count + ' observations' : '') + (l.lastSeen ? ' . last seen ' + new Date(l.lastSeen).toLocaleDateString() : '') + '</div>';
      box.appendChild(d);
    }
  }

  // JOURNAL TAB
  async function loadJournal(date) {
    currentDate = date;
    loadInsight("journal", "ib-journal", "?date=" + encodeURIComponent(date));
    $("day-pick").value = date;
    const d = new Date(date + "T00:00:00Z");
    $("day-title").textContent = d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const r = await fetch("/api/project/day?date=" + encodeURIComponent(date)).then(x => x.json()).catch(() => null);
    const tiles = $("day-tiles");
    if (!r) { tiles.innerHTML = ""; return; }
    tiles.innerHTML =
      '<div class="day-tile"><div class="lbl">observations</div><div class="val">' + r.observations + '</div></div>' +
      '<div class="day-tile"><div class="lbl">sessions</div><div class="val">' + r.sessions.length + '</div></div>' +
      '<div class="day-tile"><div class="lbl">files touched</div><div class="val">' + r.topFiles.length + '</div></div>' +
      '<div class="day-tile' + (r.driftCount > 0 ? ' alert' : '') + '"><div class="lbl">drift flags</div><div class="val">' + r.driftCount + '</div></div>' +
      '<div class="day-tile"><div class="lbl">tools used</div><div class="val">' + Object.keys(r.tools).length + '</div></div>' +
      '<div class="day-tile"><div class="lbl">skills</div><div class="val">' + Object.keys(r.skills).length + '</div></div>';

    const filesBox = $("day-files");
    if (r.topFiles.length === 0) { filesBox.innerHTML = '<div class="empty">no activity on this day</div>'; }
    else {
      filesBox.innerHTML = "";
      const max = r.topFiles[0].count;
      for (const f of r.topFiles) {
        const row = document.createElement("div"); row.className = "lb-row";
        const pct = Math.round((f.count / max) * 100);
        row.innerHTML = '<div class="path" title="' + escape(f.path) + '">' + escape(f.path) + '</div><div class="stats">' + f.count + ' touch' + (f.count === 1 ? '' : 'es') + '</div><div class="bar"><i style="width:' + pct + '%"></i></div>';
        filesBox.appendChild(row);
      }
    }

    const toolsBox = $("day-tools");
    const toolsArr = Object.entries(r.tools).sort((a,b)=>b[1]-a[1]).slice(0,12);
    if (toolsArr.length === 0) { toolsBox.innerHTML = '<div class="empty">no tool calls on this day</div>'; }
    else { toolsBox.innerHTML = toolsArr.map(([t,n]) => '<span class="kpill" data-k="run">' + escape(t) + ' . ' + n + '</span>').join(""); }

    const sessBox = $("day-sessions");
    if (r.sessions.length === 0) { sessBox.innerHTML = '<div class="empty">no sessions on this day</div>'; }
    else { sessBox.innerHTML = r.sessions.map(s => '<a href="#" data-sess="' + escape(s) + '" class="hit"><div class="meta">session</div><div class="sum">' + escape(s) + '</div></a>').join(""); }
  }
  $("day-prev").onclick = () => { const d = new Date(currentDate); d.setUTCDate(d.getUTCDate() - 1); loadJournal(d.toISOString().slice(0, 10)); };
  $("day-next").onclick = () => { const d = new Date(currentDate); d.setUTCDate(d.getUTCDate() + 1); loadJournal(d.toISOString().slice(0, 10)); };
  $("day-today").onclick = () => loadJournal(new Date().toISOString().slice(0, 10));
  $("day-pick").onchange = (e) => loadJournal(e.target.value);

  // SESSIONS TAB
  async function loadSessionsTable() {
    loadInsight("sessions", "ib-sessions");
    const r = await fetch("/api/sessions").then(x => x.json()).catch(() => ({ sessions: [] }));
    $("all-sess-count").textContent = String(r.sessions.length);
    const tb = $("sessions-tbody"); tb.innerHTML = "";
    for (const s of r.sessions) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="id">' + escape(s) + '</td>' +
        '<td>' + (s === current ? '<span class="status running">active</span>' : '<span class="status done">past</span>') + '</td>' +
        '<td class="actions"><button class="act" data-act="open">open</button><button class="act danger" data-act="del">delete</button></td>';
      tr.querySelector('[data-act="open"]').onclick = () => { current = s; connect(); $("sessions-sel").value = s; for (const x of document.querySelectorAll(".tab")) x.classList.toggle("on", x.dataset.tab === "live"); for (const v of document.querySelectorAll(".view")) v.classList.toggle("on", v.id === "view-live"); currentTab = "live"; };
      tr.querySelector('[data-act="del"]').onclick = () => confirmDelete(s);
      tb.appendChild(tr);
    }
  }
  function confirmDelete(sess) {
    $("modal-title").textContent = "Delete session?";
    $("modal-body").textContent = "This removes the event log and observation file for " + sess + ". Cannot be undone.";
    $("modal-bg").classList.add("on");
    $("modal-cancel").onclick = () => $("modal-bg").classList.remove("on");
    $("modal-go").onclick = async () => {
      $("modal-bg").classList.remove("on");
      const res = await fetch("/api/sessions/" + encodeURIComponent(sess), { method: "DELETE" }).catch(() => null);
      if (res && res.ok) { toast("deleted " + sess); loadSessionsTable(); loadSessions(); }
      else toast("delete failed");
    };
  }

  // MEMORY TAB
  for (const c of document.querySelectorAll("#msearch-filters .chip-btn")) {
    c.addEventListener("click", () => {
      msearchKind = c.dataset.kind;
      for (const x of document.querySelectorAll("#msearch-filters .chip-btn")) x.classList.toggle("on", x === c);
      runSearch($("msearch").value);
    });
  }
  let searchTimer = null;
  async function runSearch(q) {
    const box = $("mhits");
    if (!q || !q.trim()) { box.innerHTML = '<div class="empty">type to search this project\\'s memory across every session</div>'; return; }
    const u = new URL("/api/search", location.origin);
    u.searchParams.set("q", q);
    if (msearchKind) u.searchParams.set("kind", msearchKind);
    const r = await fetch(u).then(x => x.json()).catch(() => ({ hits: [] }));
    if (!r.hits || r.hits.length === 0) { box.innerHTML = '<div class="empty">no matching observations</div>'; return; }
    box.innerHTML = "";
    for (const h of r.hits) {
      const d = document.createElement("div"); d.className = "hit";
      d.innerHTML = '<div class="meta"><span class="id">#' + h.id + '</span> <span class="kpill" data-k="' + escape(h.kind) + '">' + escape(h.kind) + '</span> ' + escape((h.ts||"").slice(0,16).replace("T"," ")) + ' . score ' + h.score + '</div><div class="sum">' + escape(h.summary) + '</div>';
      d.onclick = async () => {
        const open = d.querySelector(".detail");
        if (open) { open.remove(); return; }
        const o = await fetch("/api/observation/" + h.id).then(x => x.json()).catch(() => null);
        const det = document.createElement("div"); det.className = "detail"; det.textContent = o && o.detail ? o.detail : "(no detail)";
        d.appendChild(det);
      };
      box.appendChild(d);
    }
  }
  const ms = $("msearch");
  if (ms) ms.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(ms.value), 250); });

  // ACTIONS
  $("refresh-btn").onclick = () => {
    if (currentTab === "flow") loadFlow();
    else if (currentTab === "memory") loadMemoryOverview();
    else if (currentTab === "project") loadProject();
    else if (currentTab === "journal") loadJournal(currentDate);
    else if (currentTab === "sessions") loadSessionsTable();
    else { loadSavings(); loadBudget(); loadLiveInsight(); }
    toast("refreshed");
  };
  $("pause-btn").onclick = () => { paused = !paused; $("pause-label").textContent = paused ? "resume" : "pause"; $("pause-btn").classList.toggle("active", paused); setConn(paused ? "warn" : "live"); };
  $("copy-btn").onclick = async () => { try { await navigator.clipboard.writeText(current); const lbl = $("copy-btn").querySelector("span"); const prev = lbl.textContent; lbl.textContent = "copied"; setTimeout(() => { lbl.textContent = prev; }, 1200); } catch {} };

  function tick() {
    const ms = Date.now() - startedAtRef.t;
    const s = Math.floor(ms/1000);
    const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60), ss = s%60;
    $("clock").textContent = (hh > 0 ? String(hh).padStart(2,"0") + ":" : "") + String(mm).padStart(2,"0") + ":" + String(ss).padStart(2,"0");
  }
  setInterval(tick, 1000);

  function setConn(status) { const dot = $("conn-dot"); dot.className = "conn-dot " + status; }

  function connect() {
    if (es) es.close();
    state = null; selected = null; seenEntryIds.clear(); renderLive();
    if (currentTab === "flow") loadFlow();
    setConn("warn");
    es = new EventSource("/api/stream?session=" + encodeURIComponent(current));
    es.addEventListener("snapshot", (ev) => {
      if (paused) return;
      state = JSON.parse(ev.data);
      if (state.startedAt) startedAtRef.t = new Date(state.startedAt).getTime();
      setConn("live"); renderLive();
    });
    es.addEventListener("state", (ev) => { if (paused) return; state = JSON.parse(ev.data); renderLive(); });
    es.onerror = () => setConn("dead");
  }

  // Boot
  fetch("/api/health").then(r => r.json()).then(h => { if (h.version) $("ver").textContent = "v" + h.version; }).catch(() => {});
  loadSessions().then(connect);
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
