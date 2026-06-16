// Pulse — the dashboard home. Answers three things at a glance: what this
// project is, what to do next, and who is working right now.
import { useEffect, useState } from "react";
import { api, type Agent } from "./api";
import { useSession } from "./App";
import { useFetch, Empty, ago } from "./common";
import { formatNum } from "./format";

function DoNext() {
  const { session } = useSession();
  const r = useFetch(() => api.resume(session), [session]);
  if (!r || !r.hasContext) return null;
  return (
    <div className="donext">
      <div className="eyebrow"><span className="pulse-dot" /> Do next</div>
      <div className="next">{r.suggestedNext || "Pick up the open thread"}</div>
      {r.openThread && <div className="thread">Open thread: {r.openThread}</div>}
      {r.filesInFlight.length > 0 && (
        <div className="files">{r.filesInFlight.map((f) => <span className="chip" key={f}>{f.split("/").slice(-2).join("/")}</span>)}</div>
      )}
    </div>
  );
}

function LiveStrip() {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    const tick = () => api.agents().then((r) => setAgents(r.agents)).catch(() => {});
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);
  const active = agents.filter((a) => a.active);
  return (
    <div className="card">
      <h2>Working right now {active.length > 0 && <span className="pulse-dot" />}</h2>
      {active.length ? (
        <div className="livestrip">
          {active.map((a) => (
            <div className="liveagent on" key={a.session}>
              <span className="who">{a.session.slice(0, 8)}</span>
              <span className="doing">{a.thread || "working"}{a.files.length ? ` · ${a.files[a.files.length - 1].split("/").slice(-1)[0]}` : ""}</span>
              <span className="when">{ago(a.ts)}</span>
            </div>
          ))}
        </div>
      ) : <Empty>No agents are working at this moment. Start a task and it appears here live.</Empty>}
    </div>
  );
}

export function PulsePage() {
  const o = useFetch(() => api.overview(), []);
  if (!o) return <Empty>Reading the project...</Empty>;
  return (
    <>
      <div className="hero">
        <div className="flowbar" />
        <h1>{o.identity.name} v{o.identity.version}</h1>
        <p>{o.narration || o.identity.description}</p>
        {o.map && (
          <div className="kpis">
            <div className="kpi"><div className="v">{formatNum(o.map.fileCount)}</div><div className="l">files</div></div>
            <div className="kpi"><div className="v">{formatNum(o.map.symbolCount)}</div><div className="l">symbols</div></div>
            <div className="kpi"><div className="v">{formatNum(o.counts.sessions)}</div><div className="l">sessions</div></div>
            <div className="kpi"><div className="v">{formatNum(o.counts.memories)}</div><div className="l">memories</div></div>
            <div className="kpi"><div className="v accent">${o.savedUsd.toFixed(2)}</div><div className="l">saved, est</div></div>
          </div>
        )}
      </div>
      <DoNext />
      <LiveStrip />
      <div className="card">
        <h2>Recent work</h2>
        {o.recent.length ? o.recent.map((r, i) => (
          <div className="row" key={i}><div className="t">{r.title}</div><div className="s">{r.summary}</div></div>
        )) : <Empty>No recent activity yet.</Empty>}
      </div>
    </>
  );
}
