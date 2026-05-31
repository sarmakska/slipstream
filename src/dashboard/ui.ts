/**
 * The dashboard UI, served as one self-contained HTML document. No build step,
 * no framework, no bundler: the server emits this string and the page talks back
 * over server-sent events. Mermaid is the only external asset and it loads from
 * a CDN; if it fails the rest of the page still works, the mind map just stays
 * as text. Everything wears the SarmaLinux palette and the terminal-prompt
 * motif so it matches the brand.
 */

export function renderDashboardHtml(session: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>claudepilot live . ${escapeHtml(session)}</title>
<style>
  :root {
    --bg:#06060c; --surface:#0d1117; --line:#1b2430; --sky:#38bdf8;
    --cyan:#22d3ee; --emerald:#34d399; --blue:#60a5fa; --fg:#f5f7fa;
    --muted:#8b9bb4; --amber:#fbbf24; --red:#f87171;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
  header{padding:16px 22px;border-bottom:1px solid var(--line);
    display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .prompt{color:var(--emerald)} .at{color:var(--muted)} .host{color:var(--cyan)}
  .path{color:var(--blue)} h1{font-size:15px;margin:0;font-weight:700}
  .pill{font-size:11px;color:var(--muted);border:1px solid var(--line);
    border-radius:999px;padding:3px 10px}
  .live{color:var(--emerald)} .replay{color:var(--amber)}
  main{display:grid;grid-template-columns:320px 1fr 360px;gap:1px;
    background:var(--line);min-height:calc(100vh - 58px)}
  section{background:var(--bg);padding:16px 18px;overflow:auto}
  h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--muted);margin:0 0 12px}
  .agent{border:1px solid var(--line);border-radius:10px;padding:10px 12px;
    margin-bottom:10px;cursor:pointer;background:var(--surface)}
  .agent.sel{border-color:var(--sky)}
  .agent .name{color:var(--sky);font-weight:700}
  .agent .task{color:var(--muted);font-size:12px;margin-top:3px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status{font-size:10px;text-transform:uppercase;letter-spacing:.08em;
    float:right;padding:1px 7px;border-radius:999px;border:1px solid var(--line)}
  .running{color:var(--emerald);border-color:var(--emerald)}
  .waiting{color:var(--amber);border-color:var(--amber)}
  .done{color:var(--muted)} .failed{color:var(--red);border-color:var(--red)}
  .entry{padding:6px 0;border-bottom:1px solid var(--line)}
  .entry .k{display:inline-block;min-width:96px;color:var(--cyan);font-size:11px}
  .entry .l{color:var(--fg)}
  .budget{margin-bottom:16px}
  .bar{height:10px;border-radius:6px;background:var(--surface);
    border:1px solid var(--line);overflow:hidden}
  .bar > i{display:block;height:100%;
    background:linear-gradient(90deg,var(--emerald),var(--cyan),var(--sky))}
  .budget .n{color:var(--muted);font-size:11px;margin-top:5px}
  pre.mermaid{background:var(--surface);border:1px solid var(--line);
    border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap}
  ol.plan{padding-left:18px;margin:0} ol.plan li{margin:4px 0;color:var(--fg)}
  select{background:var(--surface);color:var(--fg);border:1px solid var(--line);
    border-radius:6px;padding:4px 8px;font:inherit}
  footer{padding:12px 22px;color:var(--muted);font-size:11px;
    border-top:1px solid var(--line)}
  a{color:var(--sky)} .note{color:var(--muted);font-size:11px;margin-top:8px}
  .empty{color:var(--muted);padding:8px 0}
</style>
</head>
<body>
<header>
  <h1><span class="prompt">visitor</span><span class="at">@</span><span class="host">sarmalinux</span><span class="at">:</span><span class="path">~</span><span class="at">$</span> claudepilot live</h1>
  <span class="pill" id="conn"><span class="live">connecting</span></span>
  <span class="pill">session <select id="sessions"></select></span>
  <span class="pill" id="clock">00:00</span>
</header>
<main>
  <section>
    <h2>Agents</h2>
    <div id="agents"><div class="empty">waiting for the session to start</div></div>
    <div class="budget">
      <h2>Token budget</h2>
      <div class="bar"><i id="bbar" style="width:0%"></i></div>
      <div class="n" id="bnum">0 of 200000 tokens</div>
    </div>
  </section>
  <section>
    <h2>Discussion / activity <span id="who" style="color:var(--sky)"></span></h2>
    <div id="stream"><div class="empty">no activity yet</div></div>
  </section>
  <section>
    <h2>Plan</h2>
    <ol class="plan" id="plan"><li class="empty">no plan posted</li></ol>
    <h2 style="margin-top:18px">Mind map</h2>
    <pre class="mermaid" id="map">flowchart LR
  n0(["session"]) --> n1["waiting"]</pre>
    <div class="note">Everything here stays on this machine. No telemetry, local bind only.</div>
  </section>
</main>
<footer>
  SarmaLinux . <a href="https://sarmalinux.com">sarmalinux.com</a> .
  <a href="https://github.com/sarmakska/claudepilot">github.com/sarmakska/claudepilot</a>
</footer>
<script type="module">
  const escape = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let mermaid = null;
  import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")
    .then((m) => { mermaid = m.default; mermaid.initialize({ startOnLoad:false, theme:"base",
      themeVariables:{ primaryColor:"#0d1117", primaryTextColor:"#f5f7fa",
        primaryBorderColor:"#38bdf8", lineColor:"#22d3ee", fontFamily:"monospace" } }); })
    .catch(() => {});

  let current = ${JSON.stringify(session)};
  let selected = "main";
  let state = null;
  let es = null;
  const startedAtRef = { t: Date.now() };

  const $ = (id) => document.getElementById(id);

  async function loadSessions() {
    const r = await fetch("/api/sessions").then((x) => x.json()).catch(() => ({sessions:[]}));
    const sel = $("sessions"); sel.innerHTML = "";
    for (const s of r.sessions) {
      const o = document.createElement("option");
      o.value = s; o.textContent = s.slice(0, 20); if (s === current) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { current = sel.value; connect(); };
  }

  function statusClass(s){ return s; }

  function renderAgents() {
    const box = $("agents");
    if (!state || state.agents.length === 0) {
      box.innerHTML = '<div class="empty">waiting for the session to start</div>'; return;
    }
    box.innerHTML = "";
    for (const a of state.agents) {
      const d = document.createElement("div");
      d.className = "agent" + (a.id === selected ? " sel" : "");
      d.innerHTML = '<span class="status ' + statusClass(a.status) + '">' + escape(a.status) + '</span>' +
        '<div class="name">' + escape(a.id) + '</div>' +
        '<div class="task">' + escape(a.task) + '</div>';
      d.onclick = () => { selected = a.id; render(); };
      box.appendChild(d);
    }
  }

  function renderStream() {
    const box = $("stream"); $("who").textContent = selected ? " / " + selected : "";
    const a = state && state.agents.find((x) => x.id === selected);
    if (!a || a.activity.length === 0) { box.innerHTML = '<div class="empty">no activity yet</div>'; return; }
    box.innerHTML = "";
    for (const e of a.activity.slice().reverse()) {
      const d = document.createElement("div");
      d.className = "entry";
      d.innerHTML = '<span class="k">' + escape(e.kind) + '</span><span class="l">' + escape(e.label) + '</span>';
      box.appendChild(d);
    }
  }

  function renderBudget() {
    const total = state ? state.agents.reduce((s,a)=>s+a.approxTokens,0) : 0;
    const win = state ? state.windowTokens : 200000;
    const pct = Math.min(100, Math.round((total / win) * 100));
    $("bbar").style.width = pct + "%";
    $("bnum").textContent = total + " of " + win + " tokens (" + pct + "%)";
  }

  function renderPlan() {
    const ol = $("plan");
    if (!state || state.plan.length === 0) { ol.innerHTML = '<li class="empty">no plan posted</li>'; return; }
    ol.innerHTML = "";
    for (const p of state.plan) { const li = document.createElement("li"); li.textContent = p; ol.appendChild(li); }
  }

  let lastMap = "";
  async function renderMap() {
    if (!state) return;
    const nodes = state.agents.map((a, i) =>
      "  s --> a" + i + '["' + a.id.replace(/"/g,"'") + ": " + a.status + '"]').join("\\n");
    const src = "flowchart LR\\n  s([\\"" + (state.session || "session").slice(0,8) + "\\"])\\n" + (nodes || "  s");
    if (src === lastMap) return; lastMap = src;
    const el = $("map");
    if (mermaid) {
      try { const { svg } = await mermaid.render("m" + Date.now(), src); el.innerHTML = svg; return; } catch {}
    }
    el.textContent = src;
  }

  function render() { renderAgents(); renderStream(); renderBudget(); renderPlan(); renderMap(); }

  function tick() {
    const ms = Date.now() - startedAtRef.t;
    const s = Math.floor(ms/1000); const mm = String(Math.floor(s/60)).padStart(2,"0");
    $("clock").textContent = mm + ":" + String(s%60).padStart(2,"0");
  }
  setInterval(tick, 1000);

  function connect() {
    if (es) es.close();
    state = null; render();
    es = new EventSource("/api/stream?session=" + encodeURIComponent(current));
    es.addEventListener("snapshot", (ev) => { state = JSON.parse(ev.data);
      if (state.startedAt) startedAtRef.t = new Date(state.startedAt).getTime();
      $("conn").innerHTML = '<span class="live">live</span>'; render(); });
    es.addEventListener("state", (ev) => { state = JSON.parse(ev.data); render(); });
    es.onerror = () => { $("conn").innerHTML = '<span class="replay">reconnecting</span>'; };
  }

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
