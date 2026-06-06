import { useEffect, useState } from "react";
import { api, type GraphData } from "./api";
import { useSession } from "./App";
import { formatNum, formatShort } from "./format";

function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    fn().then((d) => { if (live) setData(d); }).catch(() => { if (live) setData(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

function Band({ paragraph, bullets }: { paragraph: string; bullets: string[] }) {
  if (!paragraph) return null;
  return (
    <div className="band">
      <div className="lbl">Insights</div>
      <p>{paragraph}</p>
      {bullets.length > 0 && <ul>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
    </div>
  );
}

function Empty({ children }: { children: string }) { return <div className="empty">{children}</div>; }

export function OverviewPage() {
  const o = useFetch(() => api.overview(), []);
  if (!o) return <Empty>Reading the project...</Empty>;
  return (
    <>
      <div className="hero">
        <h1>{o.identity.name} v{o.identity.version}</h1>
        <p>{o.narration || o.identity.description}</p>
        {o.map && (
          <div className="stats">
            <div className="stat"><div className="v">{formatNum(o.map.fileCount)}</div><div className="l">files</div></div>
            <div className="stat"><div className="v">{formatNum(o.map.symbolCount)}</div><div className="l">symbols</div></div>
            <div className="stat"><div className="v">{formatNum(o.counts.sessions)}</div><div className="l">sessions</div></div>
            <div className="stat"><div className="v">{formatNum(o.counts.observations)}</div><div className="l">observations</div></div>
            <div className="stat"><div className="v">{formatNum(o.counts.memories)}</div><div className="l">memories</div></div>
            <div className="stat"><div className="v">${o.savedUsd.toFixed(2)}</div><div className="l">saved, est</div></div>
          </div>
        )}
        <a className="btn" href="/api/brief" style={{ marginTop: 16 }}>download full project brief</a>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>What has been built</h2>
          <p style={{ color: "var(--muted)" }}>{o.summary.paragraph}</p>
          <div className="lbl" style={{ fontSize: 10, color: "var(--emerald)", marginTop: 8 }}>RECENT WORK</div>
          {o.recent.length ? o.recent.map((r, i) => <div className="row" key={i}><div className="t">{r.title}</div><div className="s">{r.summary}</div></div>) : <Empty>no recent activity yet</Empty>}
        </div>
        <div className="card">
          <h2>How it is organised <span className="badge">{o.map?.areas.length ?? 0}</span></h2>
          {o.map?.areas.map((a) => (
            <div className="row" key={a.area}>
              <div className="t">{a.area} <span style={{ color: "var(--muted-2)", fontSize: 11 }}>{a.files}f / {a.symbols}s</span></div>
              <div className="s">{a.role}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function LivePage() {
  const { session } = useSession();
  const band = useFetch(() => api.insights("live", session), [session]);
  const [presence, setPresence] = useState<{ id: string; mood: string; verb: string }[]>([]);
  const [failures, setFailures] = useState<{ summary: string; source: string }[]>([]);
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      api.presence(session).then((p) => setPresence(p.agents)).catch(() => {});
      api.failures(session).then((f) => setFailures(f.failures)).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [session]);
  return (
    <>
      {band && <Band paragraph={band.paragraph} bullets={band.bullets} />}
      <div className="card">
        <h2>Agents at work</h2>
        {presence.length ? <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>{presence.map((a) => (
          <div key={a.id} style={{ textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, border: "1px solid var(--line-2)", background: "var(--surface-2)", margin: "0 auto" }} />
            <div style={{ fontSize: 11, color: "var(--fg)", marginTop: 6 }}>{a.verb}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{a.id}</div>
          </div>
        ))}</div> : <Empty>no agents at work yet</Empty>}
      </div>
      <div className="card">
        <h2>Where Claude struggled <span className="badge">{failures.length}</span></h2>
        {failures.length ? failures.slice(0, 20).map((f, i) => <div className="row" key={i}><div className="t">{f.summary}</div><div className="s">{f.source}</div></div>) : <Empty>no failures detected this session</Empty>}
      </div>
    </>
  );
}

export function FlowPage() {
  const { session } = useSession();
  const story = useFetch(() => api.story(session), [session]);
  if (!story) return <Empty>Reading the session...</Empty>;
  return (
    <div className="card">
      <h2>Conversation flow <span className="badge">{story.promptCount} prompts</span> <a className="btn" href={`/api/report?session=${encodeURIComponent(session)}`}>download report</a></h2>
      {story.lanes.length ? story.lanes.map((l) => (
        <div className="lane" key={l.index}>
          <div className="said"><div className="who">{l.opening ? "start" : "you said"}</div><div className="what">{l.opening ? "Session opened" : l.prompt}</div></div>
          <div className="did">
            <div className="sum">{l.summary}</div>
            {l.actions.map((a, i) => <div className="act" key={i}>{a.label}</div>)}
            {l.files.length > 0 && <div>{l.files.map((f) => <span className="chip" key={f}>{f.split("/").slice(-2).join("/")}</span>)}</div>}
          </div>
        </div>
      )) : <Empty>no conversation yet for this session</Empty>}
    </div>
  );
}

export function ConversationPage() {
  const { session } = useSession();
  const conv = useFetch(() => api.conversation(session), [session]);
  return (
    <div className="card">
      <h2>Conversation <span className="badge">{conv?.exchanges.length ?? 0} exchanges</span></h2>
      {conv && conv.exchanges.length ? conv.exchanges.map((e, i) => (
        <div className="lane" key={i}>
          <div className="said"><div className="who">you said</div><div className="what">{e.ask}</div></div>
          <div className="did"><div className="sum">{e.summary}</div>{e.tools.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        </div>
      )) : <Empty>no conversation recorded for this session yet</Empty>}
    </div>
  );
}

export function ProjectPage() {
  const band = useFetch(() => api.insights("project"), []);
  const s = useFetch(() => api.projectSummary(), []) as Record<string, number> | null;
  return (
    <>
      {band && <Band paragraph={band.paragraph} bullets={band.bullets} />}
      <div className="card">
        <h2>Project totals</h2>
        {s ? (
          <div className="stats">
            <div className="stat"><div className="v">{formatNum(s.sessions)}</div><div className="l">sessions</div></div>
            <div className="stat"><div className="v">{formatNum(s.observations)}</div><div className="l">observations</div></div>
            <div className="stat"><div className="v">{formatNum(s.uniqueFiles)}</div><div className="l">files</div></div>
            <div className="stat"><div className="v">{formatShort(s.optPct)}%</div><div className="l">optimised</div></div>
            <div className="stat"><div className="v">{formatNum(s.driftCount)}</div><div className="l">drift flags</div></div>
          </div>
        ) : <Empty>reading the project...</Empty>}
      </div>
    </>
  );
}

export function JournalPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const band = useFetch(() => api.insights("journal", date), [date]);
  const day = useFetch(() => api.day(date), [date]) as Record<string, unknown> | null;
  const shift = (delta: number) => { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + delta); setDate(d.toISOString().slice(0, 10)); };
  const topFiles = (day?.topFiles as { path: string; count: number }[]) ?? [];
  const tools = Object.entries((day?.tools as Record<string, number>) ?? {}).sort((a, b) => b[1] - a[1]);
  const sessions = (day?.sessions as string[]) ?? [];
  const obsCount = (day?.observations as number) ?? 0;
  return (
    <>
      <div className="card">
        <h2>Daily journal</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => shift(-1)}>&lt; prev</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn" onClick={() => shift(1)}>next &gt;</button>
          <button className="btn" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>today</button>
        </div>
      </div>
      {band && <Band paragraph={band.paragraph} bullets={band.bullets} />}
      <div className="card">
        <h2>Summary for {date}</h2>
        <div className="stats">
          <div className="stat"><div className="v">{formatNum(obsCount)}</div><div className="l">observations</div></div>
          <div className="stat"><div className="v">{formatNum(sessions.length)}</div><div className="l">sessions</div></div>
          <div className="stat"><div className="v">{formatNum(topFiles.length)}</div><div className="l">files touched</div></div>
          <div className="stat"><div className="v">{formatNum(tools.length)}</div><div className="l">tools used</div></div>
          <div className="stat"><div className="v">{formatNum((day?.driftCount as number) ?? 0)}</div><div className="l">drift flags</div></div>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Top files this day</h2>
          {topFiles.length ? topFiles.map((f) => <div className="row" key={f.path}><div className="t">{f.path}</div><div className="s">{f.count} touches</div></div>) : <Empty>no activity on this day</Empty>}
        </div>
        <div className="card">
          <h2>Tools used</h2>
          {tools.length ? tools.map(([t, n]) => <span className="chip" key={t}>{t} · {n}</span>) : <Empty>no tool calls on this day</Empty>}
          <h2 style={{ marginTop: 14 }}>Sessions</h2>
          {sessions.length ? sessions.map((s) => <div className="row" key={s}><div className="t">{s}</div></div>) : <Empty>no sessions on this day</Empty>}
        </div>
      </div>
    </>
  );
}

export function SessionsPage() {
  const { session } = useSession();
  const r = useFetch(() => api.sessions(), []);
  return (
    <div className="card">
      <h2>All sessions <span className="badge">{r?.sessions.length ?? 0}</span></h2>
      <table>
        <thead><tr><th>id</th><th>status</th></tr></thead>
        <tbody>
          {(r?.sessions ?? []).map((s) => <tr key={s}><td>{s}</td><td style={{ color: s === session ? "var(--emerald)" : "var(--muted)" }}>{s === session ? "active" : "past"}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function MemoryPage() {
  const m = useFetch(() => api.memory(), []);
  const ins = useFetch(() => api.instincts(), []);
  if (!m) return <Empty>Reading memory...</Empty>;
  return (
    <>
      <div className="card">
        <h2>Memory that survives <span className="badge">{m.counts.memories} memories</span></h2>
        <p style={{ color: "var(--muted)" }}>{m.summary.paragraph}</p>
        {m.health && <div style={{ fontSize: 12, color: "var(--muted-2)", marginTop: 6 }}>Health: {m.health.note}</div>}
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Durable facts</h2>
          {m.durable.length ? m.durable.map((d) => <div className="row" key={d.name}><div className="t">{d.name}</div><div className="s">{d.description}</div></div>) : <Empty>no durable memories yet</Empty>}
        </div>
        <div className="card">
          <h2>Instincts</h2>
          {ins && ins.instincts.length ? ins.instincts.map((i, k) => <div className="row" key={k}><div className="t">{i.subject} · {Math.round(i.confidence * 100)}%</div><div className="s">{i.note}</div></div>) : <Empty>no recurring patterns yet</Empty>}
        </div>
      </div>
      <div className="card">
        <h2>Lessons</h2>
        {m.lessons.length ? m.lessons.map((l, i) => <div className="row" key={i}><div className="t">{l.title ?? l.topic ?? "lesson"}</div><div className="s">{l.summary ?? l.body ?? ""}</div></div>) : <Empty>collecting lessons</Empty>}
      </div>
    </>
  );
}

export function GraphPage() {
  const g = useFetch(() => api.graph(), []);
  const [selected, setSelected] = useState<string | null>(null);
  if (!g) return <Empty>building the graph...</Empty>;
  const detail = selected ? graphDetail(g, selected) : null;
  return (
    <div className="card">
      <h2>Knowledge graph <span className="badge">{g.nodes.length} nodes</span></h2>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 280px" }}>
        <GraphSvg data={g} onSelect={setSelected} />
        <div className="card" style={{ margin: 0 }}>
          {detail ? (
            <>
              <div className="t" style={{ fontWeight: 600 }}>{detail.label}</div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted-2)", margin: "4px 0 10px" }}>{detail.kind} · {detail.weight}x</div>
              {detail.connections.map((c, i) => <div className="s" key={i} style={{ borderTop: "1px solid var(--line)", padding: "5px 0" }}>{c.label} · {c.weight}x</div>)}
            </>
          ) : <Empty>click a node to read what connects to it</Empty>}
        </div>
      </div>
    </div>
  );
}

function graphDetail(g: GraphData, id: string) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const node = byId.get(id)!;
  const connections: { label: string; weight: number }[] = [];
  for (const e of g.edges) {
    if (e.from === id && byId.has(e.to)) connections.push({ label: byId.get(e.to)!.label, weight: e.weight });
    else if (e.to === id && byId.has(e.from)) connections.push({ label: byId.get(e.from)!.label, weight: e.weight });
  }
  connections.sort((a, b) => b.weight - a.weight);
  return { label: node.label, kind: node.kind, weight: node.weight, connections };
}

function GraphSvg({ data, onSelect }: { data: GraphData; onSelect: (id: string) => void }) {
  const cx = 400, cy = 260;
  const files = data.nodes.filter((n) => n.kind === "file");
  const sessions = data.nodes.filter((n) => n.kind === "session");
  const pos = new Map<string, { x: number; y: number }>();
  const place = (arr: typeof data.nodes, radius: number) => arr.forEach((n, i) => {
    const a = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  });
  place(files, 210); place(sessions, 90);
  const maxW = Math.max(1, ...data.nodes.map((n) => n.weight));
  return (
    <svg viewBox="0 0 800 520" style={{ width: "100%", height: "auto" }}>
      {data.edges.map((e, i) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#222b3b" strokeWidth={1} />;
      })}
      {data.nodes.map((n) => {
        const p = pos.get(n.id)!;
        const r = n.kind === "session" ? 7 : 5 + Math.round((n.weight / maxW) * 13);
        return (
          <g key={n.id} style={{ cursor: "pointer" }} onClick={() => onSelect(n.id)}>
            <circle cx={p.x} cy={p.y} r={r} fill={n.kind === "session" ? "rgba(167,139,250,0.85)" : "rgba(52,211,153,0.8)"} stroke={n.kind === "session" ? "#a78bfa" : "#34d399"} />
            <text x={p.x} y={p.y + r + 10} textAnchor="middle" fill="#8b9bb4" fontSize={9}>{n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
