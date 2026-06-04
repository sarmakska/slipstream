/**
 * The dashboard UI, served as one self-contained HTML document. No build step,
 * no framework, no bundler, no CDN: every byte ships from the local server so
 * the dashboard works offline and on air-gapped machines. Bound to 127.0.0.1
 * by the server. Everything wears the SarmaLinux palette.
 *
 * v0.6 redesign: glass-on-dark, KPI strip with sparklines, inline-SVG mind map
 * (no Mermaid), pause/resume control on the live stream, copy session id,
 * filterable timeline, per-skill breakdown. All wiring uses the same /api/*
 * routes as before so the server contract is unchanged.
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
    --gradient: linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #60a5fa 100%);
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
    font-size:13px;line-height:1.55;
    min-height:100vh;
  }
  a{color:var(--sky);text-decoration:none} a:hover{color:var(--cyan)}
  button{font:inherit;color:inherit}
  ::selection{background:rgba(56,189,248,0.25)}

  /* HEADER */
  header{
    position:sticky;top:0;z-index:10;
    backdrop-filter:blur(12px) saturate(150%);
    -webkit-backdrop-filter:blur(12px) saturate(150%);
    background:rgba(8,10,18,0.72);
    border-bottom:1px solid var(--line);
    padding:14px 22px;
    display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  }
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px;letter-spacing:-0.01em}
  .brand .dot{width:8px;height:8px;border-radius:50%;background:var(--gradient);
    box-shadow:0 0 12px rgba(52,211,153,0.6)}
  .brand .name{background:var(--gradient);-webkit-background-clip:text;background-clip:text;color:transparent}
  .ver{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:2px 6px;letter-spacing:0.04em}
  .spacer{flex:1}
  .control{
    display:inline-flex;align-items:center;gap:6px;
    border:1px solid var(--line);border-radius:7px;
    background:rgba(13,17,23,0.6);padding:5px 10px;
    font-size:11px;color:var(--muted);cursor:pointer;transition:all .15s;
  }
  .control:hover{border-color:var(--sky);color:var(--fg)}
  .control.active{border-color:var(--emerald);color:var(--emerald)}
  .control .ico{width:10px;height:10px;display:inline-block;border-radius:2px}
  .conn-pill{display:inline-flex;align-items:center;gap:7px;
    border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:11px}
  .conn-dot{position:relative;width:7px;height:7px;border-radius:50%;background:var(--muted-2)}
  .conn-dot.live{background:var(--emerald)}
  .conn-dot.live::after{content:'';position:absolute;inset:-4px;border-radius:50%;
    background:var(--emerald);opacity:0.5;animation:ping 2s ease-in-out infinite}
  .conn-dot.warn{background:var(--amber)}
  .conn-dot.dead{background:var(--red)}
  @keyframes ping{0%{transform:scale(0.8);opacity:0.5}80%,100%{transform:scale(2.2);opacity:0}}
  .conn-pill select{background:transparent;color:var(--fg);border:0;font:inherit;padding:0;cursor:pointer}
  .conn-pill select:focus{outline:none}

  /* KPI STRIP */
  .kpis{
    display:grid;grid-template-columns:repeat(6,1fr);gap:12px;
    padding:18px 22px 8px;
  }
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
  .kpi .val{font-size:22px;font-weight:700;letter-spacing:-0.02em;color:var(--fg);
    font-variant-numeric:tabular-nums}
  .kpi .sub{font-size:10px;color:var(--muted-2);margin-top:2px}
  .kpi .spark{position:absolute;right:8px;bottom:6px;width:64px;height:22px;opacity:0.85;pointer-events:none}
  .kpi.warn{border-color:rgba(251,191,36,0.4)}
  .kpi.compact{border-color:rgba(248,113,113,0.4)}
  .kpi.flash{animation:flash 0.6s ease-out}
  @keyframes flash{0%{box-shadow:0 0 0 0 rgba(56,189,248,0.35)}100%{box-shadow:0 0 0 0 transparent}}

  /* MAIN GRID */
  main{
    display:grid;grid-template-columns:300px 1fr 360px;gap:14px;
    padding:6px 18px 18px;
    align-items:stretch;
  }
  @media (max-width:1200px){main{grid-template-columns:260px 1fr 320px}}
  @media (max-width:900px){main{grid-template-columns:1fr}}

  .panel{
    border:1px solid var(--line);border-radius:14px;
    background:linear-gradient(180deg, rgba(13,17,23,0.7), rgba(8,10,18,0.7));
    padding:14px 16px;overflow:auto;
    max-height:calc(100vh - 220px);
  }
  .panel h2{
    font-size:10px;letter-spacing:0.16em;text-transform:uppercase;
    color:var(--muted);margin:0 0 10px;
    display:flex;align-items:center;justify-content:space-between;gap:8px;
  }
  .panel h2 .badge{
    font-size:10px;color:var(--cyan);background:rgba(34,211,238,0.08);
    border:1px solid rgba(34,211,238,0.25);border-radius:999px;
    padding:1px 7px;letter-spacing:0.06em;text-transform:none;
  }
  .panel + .panel{margin-top:12px}

  /* AGENTS */
  .agent{
    border:1px solid var(--line);border-radius:10px;
    padding:9px 11px;margin-bottom:8px;cursor:pointer;
    background:rgba(16,20,30,0.5);
    transition:all .15s;
  }
  .agent:hover{border-color:var(--line-2);background:rgba(16,20,30,0.8)}
  .agent.sel{border-color:var(--sky);background:rgba(56,189,248,0.06);
    box-shadow:0 0 0 1px rgba(56,189,248,0.25)}
  .agent .name{color:var(--sky);font-weight:700;font-size:12px}
  .agent .task{color:var(--muted);font-size:11px;margin-top:3px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;
    float:right;padding:2px 7px;border-radius:999px;border:1px solid var(--line)}
  .running{color:var(--emerald);border-color:rgba(52,211,153,0.4)}
  .waiting{color:var(--amber);border-color:rgba(251,191,36,0.4)}
  .done{color:var(--muted);border-color:var(--line)}
  .failed{color:var(--red);border-color:rgba(248,113,113,0.4)}

  /* TIMELINE */
  .filter-row{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
  .chip-btn{
    font-size:10px;letter-spacing:0.04em;
    border:1px solid var(--line);border-radius:999px;
    padding:3px 9px;background:transparent;color:var(--muted);cursor:pointer;
  }
  .chip-btn:hover{color:var(--fg);border-color:var(--line-2)}
  .chip-btn.on{background:rgba(56,189,248,0.08);color:var(--sky);border-color:rgba(56,189,248,0.4)}
  .entry{
    padding:7px 0;border-bottom:1px solid var(--line);
    display:grid;grid-template-columns:80px 1fr auto;gap:10px;align-items:start;
  }
  .entry.fresh{animation:slideIn .4s ease-out}
  @keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .entry .k{color:var(--cyan);font-size:10px;text-transform:lowercase;letter-spacing:0.05em;
    padding-top:1px}
  .entry .l{color:var(--fg);font-size:12px;word-break:break-word}
  .entry .t{color:var(--muted-2);font-size:10px;font-variant-numeric:tabular-nums}

  /* PLAN */
  ol.plan{padding-left:18px;margin:0}
  ol.plan li{margin:4px 0;color:var(--fg);font-size:12px}
  ol.plan li.empty{color:var(--muted)}

  /* MIND MAP (inline SVG) */
  .map-wrap{
    border:1px solid var(--line);border-radius:10px;
    background:rgba(8,10,18,0.6);padding:10px;overflow:auto;
  }
  .map-wrap svg{display:block;width:100%;height:auto;max-height:240px}
  .map-node rect{fill:rgba(16,20,30,0.95);stroke:var(--cyan);stroke-width:1}
  .map-node.root rect{stroke:var(--emerald);stroke-width:1.5}
  .map-node.running rect{stroke:var(--emerald)}
  .map-node.waiting rect{stroke:var(--amber)}
  .map-node.failed rect{stroke:var(--red)}
  .map-node text{fill:var(--fg);font-size:10px;font-family:inherit}
  .map-edge{stroke:var(--line-2);stroke-width:1;fill:none}

  /* WORK */
  .row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:12px}
  .row .k{color:var(--muted)} .row .v{color:var(--fg);font-variant-numeric:tabular-nums}
  .files{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}
  .file{color:var(--blue);font-size:11px;padding:1px 0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;font-family:inherit}
  .chip{display:inline-block;color:var(--cyan);font-size:10px;
    border:1px solid var(--line);border-radius:999px;
    padding:1px 7px;margin:2px 4px 0 0;background:rgba(34,211,238,0.05)}

  /* BUDGET */
  .budget .bar{height:8px;border-radius:5px;background:var(--surface);
    border:1px solid var(--line);overflow:hidden}
  .budget .bar > i{display:block;height:100%;transition:width .3s ease;
    background:var(--gradient)}
  .budget .bar > i.warn{background:linear-gradient(90deg,var(--cyan),var(--amber))}
  .budget .bar > i.compact{background:linear-gradient(90deg,var(--amber),var(--red))}
  .budget .n{color:var(--muted);font-size:11px;margin-top:6px;font-variant-numeric:tabular-nums}
  .budget-edit{margin-top:10px;font-size:11px;color:var(--muted)}
  .budget-edit summary{cursor:pointer;color:var(--sky);font-size:10px;
    text-transform:uppercase;letter-spacing:0.12em;padding:4px 0}
  .budget-edit label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
  .budget-edit input{width:130px;background:var(--surface);color:var(--fg);
    border:1px solid var(--line);border-radius:5px;padding:4px 7px;font:inherit}
  .budget-edit input:focus{outline:none;border-color:var(--sky)}
  .budget-edit button{background:var(--surface);color:var(--sky);
    border:1px solid var(--sky);border-radius:5px;padding:5px 12px;
    font:inherit;cursor:pointer;margin-top:6px}
  .budget-edit button:hover{background:rgba(56,189,248,0.1)}

  /* MEMORY SEARCH */
  #msearch{width:100%;background:var(--surface);color:var(--fg);
    border:1px solid var(--line);border-radius:7px;padding:7px 10px;
    font:inherit;margin-bottom:8px}
  #msearch:focus{outline:none;border-color:var(--sky)}
  .hit{border:1px solid var(--line);border-radius:9px;padding:8px 10px;
    margin-bottom:6px;background:rgba(13,17,23,0.6);cursor:pointer;transition:border-color .15s}
  .hit:hover{border-color:var(--sky)}
  .hit .meta{color:var(--muted);font-size:10px;margin-bottom:3px}
  .hit .kind{color:var(--cyan)} .hit .id{color:var(--emerald)}
  .hit .sum{color:var(--fg);font-size:12px}
  .hit .detail{color:var(--muted);font-size:11px;margin-top:7px;
    white-space:pre-wrap;border-top:1px solid var(--line);padding-top:7px}

  /* SKILL BREAKDOWN */
  .skill-row{display:grid;grid-template-columns:1fr 60px;gap:8px;
    align-items:center;padding:4px 0;font-size:11px}
  .skill-row .name{color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .skill-row .bar{height:5px;border-radius:3px;background:var(--surface);
    border:1px solid var(--line);overflow:hidden}
  .skill-row .bar > i{display:block;height:100%;background:var(--gradient)}
  .skill-row .count{color:var(--muted);font-size:10px;text-align:right;
    font-variant-numeric:tabular-nums}

  .empty{color:var(--muted);padding:8px 0;font-size:11px;font-style:italic}
  .note{color:var(--muted-2);font-size:10px;margin-top:8px;line-height:1.5}

  /* FOOTER */
  footer{padding:12px 22px;color:var(--muted-2);font-size:11px;
    border-top:1px solid var(--line);display:flex;gap:14px;flex-wrap:wrap}
  footer .sep{color:var(--line-2)}
</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="dot"></span>
    <span class="name">slipstream</span>
    <span class="ver" id="ver">v0.5</span>
  </div>
  <span class="conn-pill" title="Active session, click select to switch">
    <span class="conn-dot" id="conn-dot"></span>
    <select id="sessions" aria-label="Active session"></select>
  </span>
  <span class="conn-pill" id="clock-pill" title="Session uptime">
    <span class="conn-dot live"></span>
    <span id="clock" style="font-variant-numeric:tabular-nums">00:00</span>
  </span>
  <div class="spacer"></div>
  <button class="control" id="pause-btn" title="Pause or resume the live stream">
    <span id="pause-label">pause</span>
  </button>
  <button class="control" id="copy-btn" title="Copy the current session id">
    <span>copy id</span>
  </button>
  <a class="control" href="https://github.com/sarmakska/slipstream" target="_blank" rel="noopener" title="Open on GitHub">
    <span>github</span>
  </a>
</header>

<div class="kpis">
  <div class="kpi" id="kpi-ctx">
    <div class="lbl">context</div>
    <div class="val" id="kpi-ctx-val">0%</div>
    <div class="sub" id="kpi-ctx-sub">0 / 200k tokens</div>
    <svg class="spark" id="kpi-ctx-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
  <div class="kpi" id="kpi-opt">
    <div class="lbl">optimised</div>
    <div class="val" id="kpi-opt-val">0%</div>
    <div class="sub" id="kpi-opt-sub">scoped vs whole-file</div>
    <svg class="spark" id="kpi-opt-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
  <div class="kpi" id="kpi-mem">
    <div class="lbl">observations</div>
    <div class="val" id="kpi-mem-val">0</div>
    <div class="sub" id="kpi-mem-sub">this project</div>
    <svg class="spark" id="kpi-mem-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
  <div class="kpi" id="kpi-tools">
    <div class="lbl">tool calls</div>
    <div class="val" id="kpi-tools-val">0</div>
    <div class="sub" id="kpi-tools-sub">this session</div>
    <svg class="spark" id="kpi-tools-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
  <div class="kpi" id="kpi-files">
    <div class="lbl">files touched</div>
    <div class="val" id="kpi-files-val">0</div>
    <div class="sub" id="kpi-files-sub">unique paths</div>
    <svg class="spark" id="kpi-files-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
  <div class="kpi" id="kpi-agents">
    <div class="lbl">agents</div>
    <div class="val" id="kpi-agents-val">0</div>
    <div class="sub" id="kpi-agents-sub">running / total</div>
    <svg class="spark" id="kpi-agents-spark" viewBox="0 0 64 22" preserveAspectRatio="none"></svg>
  </div>
</div>

<main>
  <div>
    <div class="panel">
      <h2>Agents <span class="badge" id="agents-count">0</span></h2>
      <div id="agents"><div class="empty">waiting for the session to start</div></div>
    </div>
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
    <div class="panel">
      <h2>Per-skill activity</h2>
      <div id="skills"><div class="empty">no tool calls yet</div></div>
    </div>
  </div>

  <div>
    <div class="panel">
      <h2>Activity <span id="who" style="color:var(--sky);font-weight:400;text-transform:none;letter-spacing:0">/</span></h2>
      <div class="filter-row" id="filters"></div>
      <div id="stream"><div class="empty">no activity yet</div></div>
    </div>
  </div>

  <div>
    <div class="panel">
      <h2>Plan</h2>
      <ol class="plan" id="plan"><li class="empty">no plan posted</li></ol>
    </div>
    <div class="panel">
      <h2>Mind map</h2>
      <div class="map-wrap"><svg id="map" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet"></svg></div>
    </div>
    <div class="panel">
      <h2>Session work</h2>
      <div id="work"><div class="empty">no work yet</div></div>
    </div>
    <div class="panel">
      <h2>Memory search</h2>
      <input id="msearch" type="search" placeholder="search past observations..." autocomplete="off" />
      <div id="mhits"><div class="empty">type to search this project's memory</div></div>
      <div class="note">Local bind only. No telemetry. The dashboard never phones home.</div>
    </div>
  </div>
</main>

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

  let current = ${JSON.stringify(session)};
  let selected = null;
  let state = null;
  let es = null;
  let paused = false;
  const startedAtRef = { t: Date.now() };
  const sparkHistory = { ctx: [], opt: [], mem: [], tools: [], files: [], agents: [] };
  const filterState = { kind: null };
  const seenEntryIds = new Set();

  async function loadSessions() {
    const r = await fetch("/api/sessions").then((x) => x.json()).catch(() => ({sessions:[]}));
    const sel = $("sessions"); sel.innerHTML = "";
    for (const s of r.sessions) {
      const o = document.createElement("option");
      o.value = s; o.textContent = s.slice(0, 22) + (s.length > 22 ? "..." : "");
      if (s === current) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { current = sel.value; connect(); };
  }

  function pushSpark(key, val, max = 40) {
    sparkHistory[key].push(val);
    if (sparkHistory[key].length > max) sparkHistory[key].shift();
  }

  function drawSpark(svgId, data, color) {
    const svg = $(svgId);
    if (!svg) return;
    svg.innerHTML = "";
    if (data.length < 2) return;
    const w = 64, h = 22;
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 1);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return x + "," + y;
    }).join(" ");
    const ns = "http://www.w3.org/2000/svg";
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", color);
    poly.setAttribute("stroke-width", "1.4");
    poly.setAttribute("stroke-linejoin", "round");
    poly.setAttribute("stroke-linecap", "round");
    svg.appendChild(poly);
  }

  function flash(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function renderAgents() {
    const box = $("agents");
    if (!state || state.agents.length === 0) {
      box.innerHTML = '<div class="empty">waiting for the session to start</div>';
      $("agents-count").textContent = "0";
      return;
    }
    $("agents-count").textContent = String(state.agents.length);
    if (!selected) selected = state.agents[0].id;
    box.innerHTML = "";
    for (const a of state.agents) {
      const d = document.createElement("div");
      d.className = "agent" + (a.id === selected ? " sel" : "");
      d.innerHTML = '<span class="status ' + a.status + '">' + escape(a.status) + '</span>' +
        '<div class="name">' + escape(a.id) + '</div>' +
        '<div class="task">' + escape(a.task || '') + '</div>';
      d.onclick = () => { selected = a.id; render(); };
      box.appendChild(d);
    }
  }

  function renderFilters() {
    if (!state) return;
    const a = state.agents.find((x) => x.id === selected);
    if (!a) { $("filters").innerHTML = ""; return; }
    const kinds = new Set(a.activity.map((e) => e.kind));
    const row = $("filters");
    row.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "chip-btn" + (filterState.kind === null ? " on" : "");
    allBtn.textContent = "all";
    allBtn.onclick = () => { filterState.kind = null; renderStream(); renderFilters(); };
    row.appendChild(allBtn);
    for (const k of kinds) {
      const b = document.createElement("button");
      b.className = "chip-btn" + (filterState.kind === k ? " on" : "");
      b.textContent = k;
      b.onclick = () => { filterState.kind = k; renderStream(); renderFilters(); };
      row.appendChild(b);
    }
  }

  function renderStream() {
    const box = $("stream");
    const a = state && state.agents.find((x) => x.id === selected);
    $("who").textContent = selected ? "/ " + selected : "/";
    if (!a || a.activity.length === 0) {
      box.innerHTML = '<div class="empty">no activity yet</div>';
      return;
    }
    const filtered = filterState.kind
      ? a.activity.filter((e) => e.kind === filterState.kind)
      : a.activity;
    if (filtered.length === 0) {
      box.innerHTML = '<div class="empty">nothing matches the current filter</div>';
      return;
    }
    box.innerHTML = "";
    const newSet = new Set();
    for (const e of filtered.slice().reverse()) {
      const id = a.id + ':' + e.seq;
      newSet.add(id);
      const d = document.createElement("div");
      d.className = "entry" + (!seenEntryIds.has(id) ? " fresh" : "");
      const t = e.ts ? new Date(e.ts).toLocaleTimeString([], {hour12:false}) : "";
      d.innerHTML = '<span class="k">' + escape(e.kind) + '</span>' +
        '<span class="l">' + escape(e.label) + '</span>' +
        '<span class="t">' + escape(t) + '</span>';
      box.appendChild(d);
    }
    for (const id of newSet) seenEntryIds.add(id);
  }

  let budgetCfg = null;
  async function loadBudget() {
    const r = await fetch("/api/budget?session=" + encodeURIComponent(current))
      .then((x) => x.json()).catch(() => null);
    if (!r) return;
    budgetCfg = r.config;
    const pct = Math.min(100, Math.round((r.fraction || 0) * 100));
    const bar = $("bbar");
    bar.style.width = pct + "%";
    bar.className = r.level === "compact" ? "compact" : r.level === "warn" ? "warn" : "";
    $("bnum").textContent = formatNum(r.served) + " of " + formatNum(r.config.targetTokens) +
      " tokens (" + pct + "%, " + r.level + ", " + (r.source || "estimated") + ")";

    // KPI: context
    $("kpi-ctx-val").textContent = pct + "%";
    $("kpi-ctx-sub").textContent = formatNum(r.served) + " / " + formatShort(r.config.targetTokens) + " tokens";
    const kctx = $("kpi-ctx");
    kctx.classList.toggle("warn", r.level === "warn");
    kctx.classList.toggle("compact", r.level === "compact");
    pushSpark("ctx", pct);
    drawSpark("kpi-ctx-spark", sparkHistory.ctx,
      r.level === "compact" ? "#f87171" : r.level === "warn" ? "#fbbf24" : "#34d399");

    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if ($("btarget")) $("btarget").value = r.config.targetTokens;
    if ($("bwarn")) $("bwarn").value = r.config.warnPct;
    if ($("bcompact")) $("bcompact").value = r.config.compactPct;
    if ($("bactual") && r.config.actualTokens != null) $("bactual").value = r.config.actualTokens;
  }

  const bsave = $("bsave");
  if (bsave) bsave.onclick = async () => {
    const body = {
      targetTokens: Number($("btarget").value) || undefined,
      warnPct: Number($("bwarn").value) || undefined,
      compactPct: Number($("bcompact").value) || undefined
    };
    const a = Number($("bactual").value);
    if (a > 0) body.actualTokens = a;
    await fetch("/api/budget", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body) }).catch(() => {});
    loadBudget();
  };

  function renderPlan() {
    const ol = $("plan");
    if (!state || state.plan.length === 0) {
      ol.innerHTML = '<li class="empty">no plan posted</li>';
      return;
    }
    ol.innerHTML = "";
    for (const p of state.plan) {
      const li = document.createElement("li");
      li.textContent = p;
      ol.appendChild(li);
    }
  }

  // Inline-SVG mind map. One root node (the session), one child per agent.
  // Lightweight, no Mermaid, no CDN.
  function renderMap() {
    if (!state) return;
    const svg = $("map");
    if (!svg) return;
    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const sid = (state.session || "session").slice(0, 8);
    const agents = state.agents || [];
    const W = 360, H = Math.max(60, 40 + agents.length * 32);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    const rootX = 16, rootY = H / 2 - 12, rootW = 80, rootH = 24;
    drawNode(svg, ns, rootX, rootY, rootW, rootH, sid, "root");

    if (agents.length === 0) {
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "map-node");
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", rootX + rootW + 20);
      t.setAttribute("y", H / 2);
      t.textContent = "waiting...";
      g.appendChild(t);
      svg.appendChild(g);
      return;
    }
    const childX = 160, childW = 180, childH = 22;
    const step = Math.min(32, (H - 24) / agents.length);
    agents.forEach((a, i) => {
      const y = 14 + i * step;
      const path = document.createElementNS(ns, "path");
      path.setAttribute("class", "map-edge");
      const x1 = rootX + rootW, y1 = rootY + rootH / 2;
      const x2 = childX, y2 = y + childH / 2;
      const mx = (x1 + x2) / 2;
      path.setAttribute("d", "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2);
      svg.appendChild(path);
      const label = (a.id + ": " + a.status).slice(0, 28);
      drawNode(svg, ns, childX, y, childW, childH, label, a.status);
    });
  }

  function drawNode(svg, ns, x, y, w, h, label, kind) {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "map-node " + (kind || ""));
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y);
    r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("rx", 6); r.setAttribute("ry", 6);
    g.appendChild(r);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", x + w / 2); t.setAttribute("y", y + h / 2 + 3);
    t.setAttribute("text-anchor", "middle");
    t.textContent = label;
    g.appendChild(t);
    svg.appendChild(g);
  }

  function renderWork() {
    const box = $("work");
    if (!state || state.agents.length === 0) {
      box.innerHTML = '<div class="empty">no work yet</div>';
      return;
    }
    const tools = {};
    const files = new Map();
    const skillCounts = new Map();
    let toolCalls = 0;
    const tokens = state.agents.reduce((s,a)=>s+a.approxTokens,0);
    for (const a of state.agents) {
      for (const e of a.activity) {
        if (e.kind !== "post-tool" && e.kind !== "pre-tool") continue;
        const parts = String(e.label).split(/\\s+/);
        const tool = parts[0] || "";
        if (!tool) continue;
        if (e.kind === "post-tool") {
          tools[tool] = (tools[tool]||0)+1;
          toolCalls++;
          skillCounts.set(tool, (skillCounts.get(tool)||0)+1);
        }
        const target = parts.slice(1).join(" ");
        if (target && /[\\\\/.]/.test(target)) files.set(target, (files.get(target)||0)+1);
      }
    }
    const chips = Object.entries(tools).sort((a,b)=>b[1]-a[1]).slice(0,8)
      .map(([t,n])=>'<span class="chip">'+escape(t)+(n>1?" x"+n:"")+'</span>').join("");
    const fileList = [...files.keys()].slice(0,12)
      .map(f=>'<div class="file" title="'+escape(f)+'">'+escape(f)+'</div>').join("");
    box.innerHTML =
      '<div class="row"><span class="k">tokens pulled</span><span class="v">'+formatNum(tokens)+'</span></div>' +
      '<div class="row"><span class="k">tool calls</span><span class="v">'+toolCalls+'</span></div>' +
      '<div class="row"><span class="k">files touched</span><span class="v">'+files.size+'</span></div>' +
      '<div class="row"><span class="k">optimised</span><span class="v" id="optv">...</span></div>' +
      (chips ? '<div style="margin-top:6px">'+chips+'</div>' : '') +
      (fileList ? '<div class="files">'+fileList+'</div>' : '');

    // KPIs
    const prevTools = sparkHistory.tools[sparkHistory.tools.length - 1] ?? 0;
    if (toolCalls > prevTools) flash("kpi-tools");
    $("kpi-tools-val").textContent = formatNum(toolCalls);
    pushSpark("tools", toolCalls);
    drawSpark("kpi-tools-spark", sparkHistory.tools, "#22d3ee");

    $("kpi-files-val").textContent = formatNum(files.size);
    pushSpark("files", files.size);
    drawSpark("kpi-files-spark", sparkHistory.files, "#60a5fa");

    const running = state.agents.filter((a) => a.status === "running").length;
    $("kpi-agents-val").textContent = running + "/" + state.agents.length;
    pushSpark("agents", state.agents.length);
    drawSpark("kpi-agents-spark", sparkHistory.agents, "#a78bfa");

    renderSkills(skillCounts);
    loadSavings();
  }

  function renderSkills(counts) {
    const box = $("skills");
    if (counts.size === 0) {
      box.innerHTML = '<div class="empty">no tool calls yet</div>';
      return;
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted[0][1] || 1;
    box.innerHTML = "";
    for (const [name, n] of sorted) {
      const row = document.createElement("div");
      row.className = "skill-row";
      const pct = Math.round((n / max) * 100);
      row.innerHTML =
        '<div><div class="name">' + escape(name) + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
        '<div class="count">' + n + '</div>';
      box.appendChild(row);
    }
  }

  async function loadSavings() {
    const s = await fetch("/api/savings").then((x) => x.json()).catch(() => null);
    const el = $("optv");
    if (el) {
      el.textContent = s && s.scopedReads
        ? "saved ~" + formatNum(s.savedTokens) + " tok (" + s.pct + "%, " + s.scopedReads + " reads)"
        : "no scoped reads yet";
    }
    if (s && s.scopedReads) {
      $("kpi-opt-val").textContent = s.pct + "%";
      $("kpi-opt-sub").textContent = formatNum(s.savedTokens) + " tokens saved";
      pushSpark("opt", s.pct);
      drawSpark("kpi-opt-spark", sparkHistory.opt, "#34d399");
    }
  }

  function renderMemKpi() {
    if (!state) return;
    const n = state.observationCount ?? state.observations?.length ?? 0;
    $("kpi-mem-val").textContent = formatNum(n);
    pushSpark("mem", n);
    drawSpark("kpi-mem-spark", sparkHistory.mem, "#a78bfa");
  }

  function formatNum(n) {
    if (n == null) return "0";
    return Number(n).toLocaleString("en-GB");
  }
  function formatShort(n) {
    if (n == null) return "0";
    if (n >= 1e6) return (n/1e6).toFixed(1) + "M";
    if (n >= 1e3) return Math.round(n/1e3) + "k";
    return String(n);
  }

  function render() {
    renderAgents();
    renderFilters();
    renderStream();
    loadBudget();
    renderPlan();
    renderMap();
    renderWork();
    renderMemKpi();
  }

  function tick() {
    const ms = Date.now() - startedAtRef.t;
    const s = Math.floor(ms/1000);
    const hh = Math.floor(s/3600);
    const mm = Math.floor((s%3600)/60);
    const ss = s%60;
    $("clock").textContent = (hh > 0 ? String(hh).padStart(2,"0") + ":" : "") +
      String(mm).padStart(2,"0") + ":" + String(ss).padStart(2,"0");
  }
  setInterval(tick, 1000);

  function setConn(status) {
    const dot = $("conn-dot");
    dot.className = "conn-dot " + status;
  }

  function connect() {
    if (es) es.close();
    state = null; selected = null; seenEntryIds.clear(); render();
    setConn("warn");
    es = new EventSource("/api/stream?session=" + encodeURIComponent(current));
    es.addEventListener("snapshot", (ev) => {
      if (paused) return;
      state = JSON.parse(ev.data);
      if (state.startedAt) startedAtRef.t = new Date(state.startedAt).getTime();
      setConn("live"); render();
    });
    es.addEventListener("state", (ev) => {
      if (paused) return;
      state = JSON.parse(ev.data); render();
    });
    es.onerror = () => setConn("dead");
  }

  // Pause / resume the live stream without closing the connection.
  $("pause-btn").onclick = () => {
    paused = !paused;
    $("pause-label").textContent = paused ? "resume" : "pause";
    $("pause-btn").classList.toggle("active", paused);
    setConn(paused ? "warn" : "live");
  };

  // Copy the full session id to the clipboard.
  $("copy-btn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(current);
      const lbl = $("copy-btn").querySelector("span");
      const prev = lbl.textContent;
      lbl.textContent = "copied";
      setTimeout(() => { lbl.textContent = prev; }, 1200);
    } catch {}
  };

  // Memory search.
  let searchTimer = null;
  async function runSearch(q) {
    const box = $("mhits");
    if (!q || !q.trim()) {
      box.innerHTML = '<div class="empty">type to search this project\\'s memory</div>';
      return;
    }
    const r = await fetch("/api/search?q=" + encodeURIComponent(q) +
      "&session=" + encodeURIComponent(current))
      .then((x) => x.json()).catch(() => ({ hits: [] }));
    if (!r.hits || r.hits.length === 0) {
      box.innerHTML = '<div class="empty">no matching observations</div>';
      return;
    }
    box.innerHTML = "";
    for (const h of r.hits) {
      const d = document.createElement("div");
      d.className = "hit";
      d.innerHTML = '<div class="meta"><span class="id">#' + h.id + '</span> ' +
        '<span class="kind">' + escape(h.kind) + '</span> ' +
        escape((h.ts||"").slice(0,16).replace("T"," ")) +
        ' . score ' + h.score + '</div>' +
        '<div class="sum">' + escape(h.summary) + '</div>';
      d.onclick = async () => {
        const open = d.querySelector(".detail");
        if (open) { open.remove(); return; }
        const o = await fetch("/api/observation/" + h.id).then((x) => x.json()).catch(() => null);
        const det = document.createElement("div");
        det.className = "detail";
        det.textContent = o && o.detail ? o.detail : "(no detail)";
        d.appendChild(det);
      };
      box.appendChild(d);
    }
  }
  const ms = $("msearch");
  if (ms) ms.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(ms.value), 250);
  });

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
