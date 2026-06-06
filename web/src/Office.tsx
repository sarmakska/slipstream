import { useEffect, useState } from "react";
import { api } from "./api";

interface Agent { session: string; thread: string; files: string[]; ts: string; active: boolean; ageMin: number; }

const SKINS = ["#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#fbbf24", "#fb7185", "#818cf8", "#2dd4bf"];

// An original pixel-style office: every open Claude Code tab on this project is a
// character at a desk, working on its own thing. No external assets; the
// characters are drawn with CSS blocks. Data comes from the shared agent bus.
export function Office() {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    const tick = () => api.agents().then((r) => setAgents(r.agents)).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h2>Agents office <span className="badge">{agents.filter((a) => a.active).length} active</span></h2>
      <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>Every Claude Code tab open on this project, working at its own desk. Updates live from the shared bus.</div>
      {agents.length === 0 ? (
        <div className="empty">no agents on the bus yet. Open Claude Code in this project and each tab appears here.</div>
      ) : (
        <div className="office-floor">
          {agents.map((a, i) => {
            const skin = SKINS[i % SKINS.length]!;
            return (
              <div className="desk" key={a.session}>
                {a.thread && <div className="bubble">{a.thread.slice(0, 70)}</div>}
                <div className={"toon" + (a.active ? " busy" : "")}>
                  <div className="head" style={{ background: skin }} />
                  <div className="body" style={{ background: skin }} />
                </div>
                <div className="deskplate" />
                <div className="who">{a.session.slice(0, 8)} {a.active ? "· working" : `· idle ${a.ageMin}m`}</div>
                {a.files.length > 0 && <div className="files">{a.files.slice(0, 2).map((f) => f.split("/").pop()).join(", ")}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
