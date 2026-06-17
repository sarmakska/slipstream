// What is learned — the knowledge slipstream has accumulated across sessions,
// made legible: habits it is forming (instincts), recurring work (patterns),
// and the durable facts it remembers. Not flat lists — the story of what stuck.
import { api, type Instinct } from "./api";
import { useFetch, Empty } from "./common";
import { formatNum } from "./format";

function strength(c: number): { label: string; pct: number } {
  return { label: c >= 0.7 ? "established" : c >= 0.45 ? "strong" : "forming", pct: Math.round(c * 100) };
}

function InstinctCard({ i }: { i: Instinct }) {
  const s = strength(i.confidence);
  const isFile = i.kind === "hot-file";
  return (
    <div className="row">
      <div className="t" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="badge" style={{ color: isFile ? "var(--amber)" : "var(--violet)", borderColor: isFile ? "rgba(251,191,36,0.3)" : "rgba(167,139,250,0.3)", background: "transparent" }}>
          {isFile ? "hot file" : "recurring topic"}
        </span>
        <span style={{ fontFamily: isFile ? "var(--mono)" : "inherit" }}>{isFile ? i.subject.split("/").slice(-1)[0] : i.subject}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-2)" }}>{s.label} · {s.pct}%</span>
      </div>
      <div className="s">{i.note}</div>
      <div className="bar"><span style={{ width: `${s.pct}%` }} /></div>
    </div>
  );
}

export function MemoryPage() {
  const m = useFetch(() => api.memory(), []);
  const ins = useFetch(() => api.instincts(), []);
  if (!m) return <Empty>Reading memory...</Empty>;
  const instincts = (ins?.instincts ?? []).slice().sort((a, b) => b.confidence - a.confidence);
  return (
    <>
      <div className="hero">
        <div className="flowbar" />
        <h1>What is learned</h1>
        <p>{m.summary.paragraph}</p>
        {m.summary.bullets.length > 0 && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 13 }}>
            {m.summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
        <div className="kpis">
          <div className="kpi"><div className="v">{formatNum(m.counts.memories)}</div><div className="l">durable facts</div></div>
          <div className="kpi"><div className="v">{formatNum(instincts.length)}</div><div className="l">instincts</div></div>
          <div className="kpi"><div className="v">{formatNum(m.lessons.length)}</div><div className="l">work patterns</div></div>
        </div>
      </div>

      <div className="card">
        <h2>Habits forming <span className="badge">{instincts.length}</span></h2>
        <div className="empty" style={{ marginTop: 0 }}>Patterns slipstream keeps noticing — the more they recur, the stronger the instinct.</div>
        {instincts.length ? instincts.map((i, k) => <InstinctCard key={k} i={i} />) : <Empty>No recurring patterns yet.</Empty>}
      </div>

      <div className="card">
        <h2>Recurring work <span className="badge">{m.lessons.length}</span></h2>
        {m.lessons.length ? m.lessons.map((l, i) => (
          <div className="row" key={i}>
            <div className="t" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {l.topic ?? l.title ?? "work"}
              {l.count != null && <span className="badge">{l.count}x</span>}
              {l.dominantKind && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-2)" }}>mostly {l.dominantKind}{l.sessions != null ? ` · ${l.sessions} sessions` : ""}</span>}
            </div>
            <div className="s">{l.summary ?? l.body ?? ""}</div>
            {l.files && l.files.length > 0 && <div>{l.files.slice(0, 6).map((f) => <span className="chip" key={f}>{f.split("/").slice(-1)[0]}</span>)}</div>}
          </div>
        )) : <Empty>Collecting patterns.</Empty>}
      </div>

      <div className="card">
        <h2>Durable facts <span className="badge">{m.durable.length}</span></h2>
        {m.durable.length ? m.durable.map((d) => (
          <div className="row" key={d.name}><div className="t">{d.name}</div><div className="s">{d.description}</div></div>
        )) : <Empty>No durable facts saved yet. They are written with the remember command and survive every future session.</Empty>}
      </div>
    </>
  );
}
