// Memory — what survives across sessions: durable facts, and a Hindsight panel
// that elevates the instincts and lessons slipstream has accumulated.
import { api } from "./api";
import { useFetch, Empty } from "./common";

export function MemoryPage() {
  const m = useFetch(() => api.memory(), []);
  const ins = useFetch(() => api.instincts(), []);
  if (!m) return <Empty>Reading memory...</Empty>;
  return (
    <>
      <div className="hero">
        <div className="flowbar" />
        <h1>What has been learned</h1>
        <p>{m.summary.paragraph}</p>
        {m.health && <div style={{ fontSize: 12, color: "var(--muted-2)", marginTop: 8 }}>Health: {m.health.note}</div>}
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Durable facts <span className="badge">{m.durable.length}</span></h2>
          {m.durable.length ? m.durable.map((d) => (
            <div className="row" key={d.name}><div className="t">{d.name}</div><div className="s">{d.description}</div></div>
          )) : <Empty>No durable memories yet.</Empty>}
        </div>
        <div className="card">
          <h2>Hindsight — recurring instincts <span className="badge">{ins?.instincts.length ?? 0}</span></h2>
          {ins && ins.instincts.length ? ins.instincts.map((i, k) => (
            <div className="row" key={k}>
              <div className="t">{i.subject} <span style={{ color: "var(--muted-2)", fontSize: 11 }}>{Math.round(i.confidence * 100)}%</span></div>
              <div className="s">{i.note}</div>
              <div className="bar"><span style={{ width: `${Math.round(i.confidence * 100)}%` }} /></div>
            </div>
          )) : <Empty>No recurring patterns yet.</Empty>}
        </div>
      </div>
      <div className="card">
        <h2>Lessons <span className="badge">{m.lessons.length}</span></h2>
        {m.lessons.length ? m.lessons.map((l, i) => (
          <div className="row" key={i}><div className="t">{l.title ?? l.topic ?? "lesson"}</div><div className="s">{l.summary ?? l.body ?? ""}</div></div>
        )) : <Empty>Collecting lessons.</Empty>}
      </div>
    </>
  );
}
