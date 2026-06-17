import { createContext, useContext, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { api } from "./api";
import { OfficePage } from "./office";
import { SessionsPage } from "./sessions";
import { MemoryPage } from "./memory";
import { CodeGraphView } from "./CodeGraph";

function MapPage() {
  return (
    <>
      <div className="hero">
        <div className="flowbar" />
        <h1>Code map</h1>
        <p>Where the project's weight sits. Each dot is a file, sized by how many files depend on it; the white-ringed ones are the god nodes everything flows through — read those first. Colour groups by area. Scroll to zoom, drag to pan, click a node for its dependencies.</p>
      </div>
      <div className="card"><CodeGraphView /></div>
    </>
  );
}

interface SessionCtx { session: string; setSession: (s: string) => void; sessions: string[]; }
const Ctx = createContext<SessionCtx>({ session: "", setSession: () => {}, sessions: [] });
export const useSession = (): SessionCtx => useContext(Ctx);

const NAV: { section: string; items: { path: string; label: string }[] }[] = [
  { section: "Now", items: [
    { path: "/", label: "The office" },
    { path: "/sessions", label: "Sessions" }
  ] },
  { section: "Knowledge", items: [
    { path: "/memory", label: "What is learned" },
    { path: "/map", label: "Code map" }
  ] }
];

export function App() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [session, setSession] = useState("");
  const [version, setVersion] = useState("");
  const [location] = useLocation();

  useEffect(() => {
    api.sessions().then((r) => { setSessions(r.sessions); setSession((s) => s || r.sessions[0] || "main"); }).catch(() => {});
    api.health().then((h) => setVersion(h.version)).catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ session, setSession, sessions }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand"><span className="dot" /><span className="name">slipstream</span></div>
          <div className="ver">v{version || "..."}</div>
          <nav className="nav">
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="nav-section">{group.section}</div>
                {group.items.map((n) => (
                  <Link key={n.path} href={n.path} className={location === n.path ? "on" : ""}>
                    <span className="ico" />{n.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <div>
          <div className="topbar">
            <span className="pill"><span className="d live" /> local 127.0.0.1</span>
            <span className="sp" />
            <span className="pill">
              session&nbsp;
              <select value={session} onChange={(e) => setSession(e.target.value)}>
                {sessions.map((s) => <option key={s} value={s}>{s.slice(0, 20)}</option>)}
              </select>
            </span>
          </div>
          <main className="content">
            <Switch>
              <Route path="/" component={OfficePage} />
              <Route path="/sessions" component={SessionsPage} />
              <Route path="/memory" component={MemoryPage} />
              <Route path="/map" component={MapPage} />
            </Switch>
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
