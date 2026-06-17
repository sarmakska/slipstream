// Sessions — digest-first. Each session reads as one synthesised paragraph;
// expand it for a tight timeline, never the raw dump of every action.
import { useState } from "react";
import { api } from "./api";
import { useSession } from "./App";
import { useFetch, Empty } from "./common";
import { formatNum } from "./format";

function Timeline({ session }: { session: string }) {
  const story = useFetch(() => api.story(session), [session]);
  if (!story) return <Empty>Reading the session...</Empty>;
  const steps = story.lanes.filter((l) => !l.opening);
  if (!steps.length) return <Empty>No recorded steps in this session.</Empty>;
  return (
    <div className="timeline">
      {steps.map((l) => (
        <div className="t-step" key={l.index}>
          <div className="t-ask">{l.prompt}</div>
          {l.summary && <div className="t-did">{l.summary}</div>}
        </div>
      ))}
    </div>
  );
}

function SessionCard({ session, observations }: { session: string; observations: number }) {
  const { session: active, setSession } = useSession();
  const [open, setOpen] = useState(false);
  const digest = useFetch(() => api.sessionDigest(session), [session]);
  return (
    <div className="row" style={{ borderColor: open ? "var(--emerald)" : undefined }}>
      <div className="t" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: open ? "var(--emerald)" : "var(--fg)" }}>{session.slice(0, 16)}{session === active ? " · active" : ""}</span>
        <button className="btn" onClick={() => { setSession(session); setOpen(!open); }}>{open ? "hide" : "open"}</button>
      </div>
      <div className="digest">
        {digest ? digest.paragraph : `${observations} observations recorded.`}
        {digest && (
          <div className="stats">
            <span><b>{formatNum(digest.stats.prompts)}</b> prompts</span>
            <span><b>{formatNum(digest.stats.tools)}</b> tools</span>
            <span><b>{formatNum(digest.stats.files)}</b> files</span>
            <span><b>{formatNum(digest.stats.exchanges)}</b> exchanges</span>
            <a className="chip" href={`/api/report?session=${encodeURIComponent(session)}`}>download report</a>
          </div>
        )}
      </div>
      {open && <Timeline session={session} />}
    </div>
  );
}

export function SessionsPage() {
  const r = useFetch(() => api.sessions(), []);
  const info = r?.info ?? (r?.sessions ?? []).map((s) => ({ session: s, lastTs: "", observations: 0 }));
  const byDay = new Map<string, typeof info>();
  for (const i of info) {
    const day = i.lastTs ? i.lastTs.slice(0, 10) : "undated";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  }
  const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1));
  const realDays = days.filter((d) => d !== "undated");
  const totalObs = info.reduce((n, x) => n + x.observations, 0);
  const summary = info.length
    ? `${info.length} session${info.length === 1 ? "" : "s"}${realDays.length ? ` across ${realDays.length} day${realDays.length === 1 ? "" : "s"}` : ""}, ${totalObs} observations recorded. Most recent first.`
    : "No sessions recorded yet.";
  return (
    <>
      <div className="hero">
        <div className="flowbar" />
        <h1>Sessions</h1>
        <p>{summary}</p>
      </div>
      {days.map((day) => {
        const rows = byDay.get(day)!;
        const obs = rows.reduce((n, x) => n + x.observations, 0);
        return (
          <div className="card" key={day}>
            <h2>{day === "undated" ? "Undated" : day} <span className="badge">{rows.length} session{rows.length === 1 ? "" : "s"} · {obs} obs</span></h2>
            {rows.map((i) => <SessionCard key={i.session} session={i.session} observations={i.observations} />)}
          </div>
        );
      })}
      {days.length === 0 && <div className="card"><Empty>No sessions recorded yet.</Empty></div>}
    </>
  );
}
