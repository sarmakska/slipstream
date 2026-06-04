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
<title>slipstream live . ${escapeHtml(session)}</title>
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
  .bar > i{display:block;height:100%;transition:width .3s ease;
    background:linear-gradient(90deg,var(--emerald),var(--cyan),var(--sky))}
  .bar > i.warn{background:linear-gradient(90deg,var(--cyan),var(--amber))}
  .bar > i.compact{background:linear-gradient(90deg,var(--amber),var(--red))}
  .budget .n{color:var(--muted);font-size:11px;margin-top:5px}
  .budget-edit{margin-top:8px;font-size:11px;color:var(--muted)}
  .budget-edit summary{cursor:pointer;color:var(--sky)}
  .budget-edit label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
  .budget-edit input{width:120px;background:var(--surface);color:var(--fg);
    border:1px solid var(--line);border-radius:5px;padding:3px 6px;font:inherit}
  .budget-edit button{background:var(--surface);color:var(--sky);border:1px solid var(--sky);
    border-radius:5px;padding:4px 10px;font:inherit;cursor:pointer;margin-top:4px}
  pre.mermaid{background:var(--surface);border:1px solid var(--line);
    border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap}
  ol.plan{padding-left:18px;margin:0} ol.plan li{margin:4px 0;color:var(--fg)}
  select{background:var(--surface);color:var(--fg);border:1px solid var(--line);
    border-radius:6px;padding:4px 8px;font:inherit}
  footer{padding:12px 22px;color:var(--muted);font-size:11px;
    border-top:1px solid var(--line)}
  a{color:var(--sky)} .note{color:var(--muted);font-size:11px;margin-top:8px}
  .empty{color:var(--muted);padding:8px 0}
  #msearch{width:100%;background:var(--surface);color:var(--fg);
    border:1px solid var(--line);border-radius:6px;padding:6px 9px;font:inherit;margin-bottom:8px}
  #msearch:focus{outline:none;border-color:var(--sky)}
  .hit{border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-bottom:6px;
    background:var(--surface);cursor:pointer}
  .hit:hover{border-color:var(--sky)}
  .hit .meta{color:var(--muted);font-size:10px;margin-bottom:2px}
  .hit .kind{color:var(--cyan)} .hit .id{color:var(--emerald)}
  .hit .sum{color:var(--fg);font-size:12px}
  .hit .detail{color:var(--muted);font-size:11px;margin-top:6px;white-space:pre-wrap;
    border-top:1px solid var(--line);padding-top:6px}
  #work .row{display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:12px}
  #work .row .k{color:var(--muted)} #work .row .v{color:var(--fg)}
  #work .files{margin-top:6px;border-top:1px solid var(--line);padding-top:6px}
  #work .file{color:var(--blue);font-size:11px;padding:1px 0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  #work .chip{display:inline-block;color:var(--cyan);font-size:10px;border:1px solid var(--line);
    border-radius:999px;padding:1px 7px;margin:2px 4px 0 0}
</style>
</head>
<body>
<header>
  <h1><span class="prompt">visitor</span><span class="at">@</span><span class="host">sarmalinux</span><span class="at">:</span><span class="path">~</span><span class="at">$</span> slipstream live</h1>
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
      <details class="budget-edit">
        <summary>set budget</summary>
        <label>target <input id="btarget" type="number" min="1000" step="1000" /></label>
        <label>warn % <input id="bwarn" type="number" min="1" max="99" /></label>
        <label>compact % <input id="bcompact" type="number" min="1" max="100" /></label>
        <label>actual tokens <input id="bactual" type="number" min="0" placeholder="paste from editor" /></label>
        <button id="bsave" type="button">save</button>
      </details>
      <div class="note">Shows the true context from the transcript when available (marked "actual"), otherwise an estimate of what slipstream pulled in.</div>
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
    <h2 style="margin-top:18px">Session work</h2>
    <div id="work"><div class="empty">no work yet</div></div>
    <h2 style="margin-top:18px">Memory search</h2>
    <input id="msearch" type="search" placeholder="search past observations…" autocomplete="off" />
    <div id="mhits"><div class="empty">type to search this project's memory</div></div>
    <div class="note">Everything here stays on this machine. No telemetry, local bind only.</div>
  </section>
</main>
<footer>
  SarmaLinux . <a href="https://sarmalinux.com">sarmalinux.com</a> .
  <a href="https://github.com/sarmakska/slipstream">github.com/sarmakska/slipstream</a>
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
    $("bnum").textContent = r.served + " of " + r.config.targetTokens +
      " tokens (" + pct + "%, " + r.level + ", " + (r.source || "estimated") + ")";
    // Populate the editor only when the user is not mid-edit.
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if ($("btarget")) $("btarget").value = r.config.targetTokens;
    if ($("bwarn")) $("bwarn").value = r.config.warnPct;
    if ($("bcompact")) $("bcompact").value = r.config.compactPct;
    if ($("bactual") && r.config.actualTokens != null) $("bactual").value = r.config.actualTokens;
  }
  function renderBudget() { loadBudget(); }
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

  // Phase 4: a rolled-up view of the session's work, derived from the same
  // activity stream — files touched, a tool-use breakdown and cumulative tokens.
  function renderWork() {
    const box = $("work");
    if (!state || state.agents.length === 0) { box.innerHTML = '<div class="empty">no work yet</div>'; return; }
    const tools = {};
    const files = new Map();
    let toolCalls = 0;
    const tokens = state.agents.reduce((s,a)=>s+a.approxTokens,0);
    for (const a of state.agents) {
      for (const e of a.activity) {
        if (e.kind !== "post-tool" && e.kind !== "pre-tool") continue;
        const parts = String(e.label).split(/\s+/);
        const tool = parts[0] || "";
        if (!tool) continue;
        if (e.kind === "post-tool") { tools[tool] = (tools[tool]||0)+1; toolCalls++; }
        const target = parts.slice(1).join(" ");
        if (target && /[\\/.]/.test(target)) files.set(target, (files.get(target)||0)+1);
      }
    }
    const chips = Object.entries(tools).sort((a,b)=>b[1]-a[1]).slice(0,8)
      .map(([t,n])=>'<span class="chip">'+escape(t)+(n>1?" ×"+n:"")+'</span>').join("");
    const fileList = [...files.keys()].slice(0,12)
      .map(f=>'<div class="file" title="'+escape(f)+'">'+escape(f)+'</div>').join("");
    box.innerHTML =
      '<div class="row"><span class="k">tokens pulled</span><span class="v">'+tokens+'</span></div>' +
      '<div class="row"><span class="k">tool calls</span><span class="v">'+toolCalls+'</span></div>' +
      '<div class="row"><span class="k">files touched</span><span class="v">'+files.size+'</span></div>' +
      '<div class="row"><span class="k">optimised</span><span class="v" id="optv">…</span></div>' +
      (chips ? '<div>'+chips+'</div>' : '') +
      (fileList ? '<div class="files">'+fileList+'</div>' : '');
    loadSavings();
  }
  async function loadSavings() {
    const s = await fetch("/api/savings").then((x) => x.json()).catch(() => null);
    const el = $("optv");
    if (!el) return;
    el.textContent = s && s.scopedReads
      ? "saved ~" + s.savedTokens + " tok (" + s.pct + "% vs whole-file, " + s.scopedReads + " reads)"
      : "—";
  }

  function render() { renderAgents(); renderStream(); renderBudget(); renderPlan(); renderMap(); renderWork(); }

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

  // Memory search: query the observation store and let a hit expand to its full
  // detail, fetched lazily so the index stays cheap until you ask for a body.
  let searchTimer = null;
  async function runSearch(q) {
    const box = $("mhits");
    if (!q || !q.trim()) { box.innerHTML = '<div class="empty">type to search this project\\'s memory</div>'; return; }
    const r = await fetch("/api/search?q=" + encodeURIComponent(q) +
      "&session=" + encodeURIComponent(current))
      .then((x) => x.json()).catch(() => ({ hits: [] }));
    if (!r.hits || r.hits.length === 0) { box.innerHTML = '<div class="empty">no matching observations</div>'; return; }
    box.innerHTML = "";
    for (const h of r.hits) {
      const d = document.createElement("div");
      d.className = "hit";
      d.innerHTML = '<div class="meta"><span class="id">#' + h.id + '</span> ' +
        '<span class="kind">' + escape(h.kind) + '</span> ' + escape((h.ts||"").slice(0,16).replace("T"," ")) +
        ' · score ' + h.score + '</div><div class="sum">' + escape(h.summary) + '</div>';
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
