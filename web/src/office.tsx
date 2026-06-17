// The Office — a live pixel scene of who is doing what. Each open chat window is
// a character at a desk, animated by what it is doing right now (typing, reading,
// running, thinking). The story of the work, made visible. Token savings are the
// hero. Click a character to read its session story.
//
// Sprites are the CC0 MetroCity pack (see public/assets/characters/CREDITS.md);
// the renderer below is original slipstream code.
import { useEffect, useRef, useState } from "react";
import { api, type Agent } from "./api";
import { useFetch, Empty } from "./common";
import { formatNum } from "./format";

// CC0 sheet geometry: 16x32 frames, 7 per row, rows = down / up / right.
const FW = 16, FH = 32;
const SCALE = 3;
const CW = FW * SCALE, CH = FH * SCALE; // drawn character size
const CELL_W = 150, CELL_H = 156;
const CHAR_COUNT = 6;

/** Stable character sheet for a session id. */
function charIndex(session: string): number {
  let h = 0;
  for (let i = 0; i < session.length; i++) h = (h * 31 + session.charCodeAt(i)) >>> 0;
  return h % CHAR_COUNT;
}

/** Which sprite column to draw for a mood at time t (ms). Row is always 0 (down). */
function frameColumn(mood: Agent["mood"], active: boolean, t: number): number {
  if (!active) return 0;
  switch (mood) {
    case "typing": return (Math.floor(t / 280) % 2) ? 6 : 5; // working poses
    case "reading": return 6;
    case "running": return (Math.floor(t / 160) % 2) ? 4 : 3; // walk frames
    case "delegating": return (Math.floor(t / 220) % 2) ? 5 : 6;
    default: return 0; // thinking / waiting — idle pose
  }
}

interface HitRect { x: number; y: number; w: number; h: number; session: string; }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function OfficeCanvas({ agents, onSelect }: { agents: Agent[]; onSelect: (s: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetsRef = useRef<HTMLImageElement[]>([]);
  const loadedRef = useRef(false);
  const agentsRef = useRef<Agent[]>(agents);
  const rectsRef = useRef<HitRect[]>([]);
  agentsRef.current = agents;

  // Load the six CC0 character sheets once.
  useEffect(() => {
    let done = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < CHAR_COUNT; i++) {
      const img = new Image();
      img.src = `/assets/characters/char_${i}.png`;
      img.onload = () => { if (++done === CHAR_COUNT) loadedRef.current = true; };
      imgs.push(img);
    }
    sheetsRef.current = imgs;
  }, []);

  // Game loop.
  useEffect(() => {
    let raf = 0;
    const render = (t: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        drawScene(ctx, w, h, agentsRef.current, sheetsRef.current, loadedRef.current, t, rectsRef);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const hit = rectsRef.current.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit) onSelect(hit.session);
  };

  // Height grows with the number of agents so nobody is clipped.
  const perRow = Math.max(1, Math.floor((canvasRef.current?.clientWidth ?? 900) / CELL_W));
  const rows = Math.max(1, Math.ceil(Math.max(1, agents.length) / perRow));
  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className="office-canvas"
      style={{ width: "100%", height: rows * CELL_H + 24, cursor: "pointer" }}
    />
  );
}

const WALL_H = 40;
const TOP = 44; // top of the first character row, below the wall

/** Carpet floor, back wall with windows, and a soft vignette. */
function drawRoom(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Carpet — fine tiled grid in cool greys.
  const TILE = 16;
  for (let y = WALL_H; y < h; y += TILE) {
    for (let x = 0; x < w; x += TILE) {
      ctx.fillStyle = ((x / TILE + y / TILE) % 2 === 0) ? "#141a25" : "#121823";
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,0.015)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += TILE) { ctx.beginPath(); ctx.moveTo(x, WALL_H); ctx.lineTo(x, h); ctx.stroke(); }

  // Back wall + baseboard.
  ctx.fillStyle = "#1b2230";
  ctx.fillRect(0, 0, w, WALL_H);
  ctx.fillStyle = "#0e131d";
  ctx.fillRect(0, WALL_H - 5, w, 5);
  // Windows along the wall with a faint night-glass glow.
  for (let wx = 40; wx < w - 60; wx += 200) {
    ctx.fillStyle = "#0c1018"; ctx.fillRect(wx, 8, 120, 22);
    const g = ctx.createLinearGradient(wx, 8, wx, 30);
    g.addColorStop(0, "rgba(96,165,250,0.18)"); g.addColorStop(1, "rgba(52,211,153,0.10)");
    ctx.fillStyle = g; ctx.fillRect(wx + 2, 10, 116, 18);
    ctx.strokeStyle = "#2a3547"; ctx.lineWidth = 1; ctx.strokeRect(wx, 8, 120, 22);
    ctx.beginPath(); ctx.moveTo(wx + 60, 8); ctx.lineTo(wx + 60, 30); ctx.stroke();
  }
}

/** A potted plant — a little office greenery between desks. */
function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#7c4a2d"; ctx.fillRect(x - 5, y, 10, 9);             // pot
  ctx.fillStyle = "#8a5436"; ctx.fillRect(x - 5, y, 10, 2);
  ctx.fillStyle = "#2f9e5a";                                            // leaves
  ctx.beginPath(); ctx.ellipse(x, y - 6, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#37b768";
  ctx.beginPath(); ctx.ellipse(x - 3, y - 9, 3.5, 6, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 3, y - 9, 3.5, 6, 0.5, 0, Math.PI * 2); ctx.fill();
}

/** A wood desk with a monitor (glowing when active), keyboard and mug. */
function drawDesk(ctx: CanvasRenderingContext2D, cx: number, deskY: number, active: boolean) {
  // Chair back behind the worker.
  ctx.fillStyle = "#222a38";
  roundRect(ctx, cx - 18, deskY - 54, 36, 30, 7); ctx.fill();
  // Desk top + front face (warm wood).
  ctx.fillStyle = "#5a4632"; roundRect(ctx, cx - 54, deskY - 14, 108, 14, 4); ctx.fill();
  ctx.fillStyle = "#3f3424"; ctx.fillRect(cx - 54, deskY - 1, 108, 9);
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(cx - 54, deskY - 14, 108, 2);
  // Monitor (back panel faces us) with a glowing edge when active.
  ctx.fillStyle = "#11161f"; ctx.fillRect(cx - 16, deskY - 30, 32, 20);
  ctx.fillStyle = active ? "#22d3ee" : "#2a3547";
  if (active) { ctx.save(); ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 12; ctx.fillRect(cx - 14, deskY - 28, 28, 16); ctx.restore(); }
  else ctx.fillRect(cx - 14, deskY - 28, 28, 16);
  ctx.fillStyle = "#2a3547"; ctx.fillRect(cx - 3, deskY - 10, 6, 4);   // stand
  // Keyboard + mug on the desk.
  ctx.fillStyle = "#1c2431"; ctx.fillRect(cx - 14, deskY - 7, 20, 5);
  ctx.fillStyle = active ? "#fbbf24" : "#7c869a"; ctx.fillRect(cx + 12, deskY - 8, 6, 6);
}

function drawScene(
  ctx: CanvasRenderingContext2D, w: number, h: number, agents: Agent[],
  sheets: HTMLImageElement[], loaded: boolean, t: number, rectsRef: { current: HitRect[] }
) {
  drawRoom(ctx, w, h);
  const rects: HitRect[] = [];
  if (!loaded || agents.length === 0) { rectsRef.current = rects; return; }

  const perRow = Math.max(1, Math.floor(w / CELL_W));
  agents.forEach((a, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const cx = col * CELL_W + CELL_W / 2;
    const cyTop = row * CELL_H + TOP;       // top of character
    const feet = cyTop + CH;                 // character feet / desk line
    const active = a.active;

    // A plant tucked beside every third workstation.
    if (i % 3 === 2) drawPlant(ctx, cx + 58, feet - 4);

    // Chair back is drawn inside drawDesk (behind), but the desk front must sit
    // OVER the character's lower body, so: character first, then desk front.
    const sheet = sheets[charIndex(a.session)];
    const sxCol = frameColumn(a.mood, active, t);
    // chair back behind the character
    ctx.fillStyle = "#1d2532"; roundRect(ctx, cx - 18, feet - 58, 36, 34, 8); ctx.fill();
    ctx.globalAlpha = active ? 1 : 0.4;
    if (sheet && sheet.complete) ctx.drawImage(sheet, sxCol * FW, 0, FW, FH, cx - CW / 2, cyTop, CW, CH);
    ctx.globalAlpha = 1;
    // desk + monitor in front of the seated worker
    drawDesk(ctx, cx, feet, active);

    // Speech bubble — what it is doing, or the live file.
    if (active) {
      const file = a.files.length ? a.files[a.files.length - 1].split("/").slice(-1)[0] : "";
      const label = file || a.verb || "working";
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      const tw = Math.min(132, ctx.measureText(label).width + 16);
      const bx = cx - tw / 2, by = cyTop - 24;
      ctx.fillStyle = "rgba(16,20,30,0.96)";
      ctx.strokeStyle = "rgba(52,211,153,0.5)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, tw, 20, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4, by + 20); ctx.lineTo(cx + 4, by + 20); ctx.lineTo(cx, by + 25); ctx.closePath(); ctx.fillStyle = "rgba(16,20,30,0.96)"; ctx.fill();
      ctx.fillStyle = "#e9f5ef";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, cx, by + 10, tw - 12);
    }

    // Session id under the desk.
    ctx.fillStyle = active ? "#8b9bb4" : "#5b6478";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(a.session.slice(0, 8), cx, feet + 12, CELL_W - 12);

    rects.push({ x: cx - CW / 2, y: cyTop, w: CW, h: CH + 12, session: a.session });
  });
  rectsRef.current = rects;
}

function StoryPanel({ session, onClose }: { session: string; onClose: () => void }) {
  const story = useFetch(() => api.story(session), [session]);
  const digest = useFetch(() => api.sessionDigest(session), [session]);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>
        Story of {session.slice(0, 12)}
        <button className="btn" onClick={onClose}>close</button>
      </h2>
      {digest && <div className="digest">{digest.paragraph}</div>}
      {story && story.lanes.filter((l) => !l.opening).length ? (
        <div className="timeline">
          {story.lanes.filter((l) => !l.opening).map((l) => (
            <div className="t-step" key={l.index}>
              <div className="t-ask">{l.prompt}</div>
              {l.summary && <div className="t-did">{l.summary}</div>}
            </div>
          ))}
        </div>
      ) : <Empty>No recorded steps yet.</Empty>}
    </div>
  );
}

export function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const overview = useFetch(() => api.overview(), []);
  useEffect(() => {
    const tick = () => api.agents()
      .then((r) => setAgents(r.agents.filter((a) => a.active || a.ageMin <= 60).slice(0, 12)))
      .catch(() => {});
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);
  const activeCount = agents.filter((a) => a.active).length;
  return (
    <>
      <div className="office-head">
        <div className="office-title">
          <span className="pulse-dot" /> The office
          <span className="office-sub">{activeCount} working now · {agents.length} on the floor</span>
        </div>
        {overview && (
          <div className="savings">
            <div className="v">{formatNum(overview.savedTokens)}</div>
            <div className="l">tokens saved · ${overview.savedUsd.toFixed(2)}</div>
          </div>
        )}
      </div>
      <div className="office-frame">
        <OfficeCanvas agents={agents} onSelect={setSelected} />
        {agents.length === 0 && (
          <div className="office-empty">No agents on the floor. Open a chat window and start a task — your character clocks in here.</div>
        )}
      </div>
      {selected && <StoryPanel session={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
