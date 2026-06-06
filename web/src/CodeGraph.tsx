import { useEffect, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation } from "d3-force";
import { api, type CodeGraph as CodeGraphData, type CodeNode } from "./api";

interface SimNode extends CodeNode { x: number; y: number; fx?: number | null; fy?: number | null; }
interface SimLink { source: SimNode; target: SimNode; }

const AREA_COLORS = ["#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#fbbf24", "#fb7185", "#818cf8", "#f472b6", "#2dd4bf", "#facc15"];
function colorFor(area: string, areas: string[]): string {
  const i = areas.indexOf(area);
  return AREA_COLORS[i % AREA_COLORS.length] ?? "#8b9bb4";
}

export function CodeGraphView() {
  const [data, setData] = useState<CodeGraphData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const W = 900, H = 600;

  useEffect(() => { api.codegraph().then(setData).catch(() => setData({ nodes: [], edges: [] })); }, []);

  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n, x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 + (Math.random() - 0.5) * 200 }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)! }))
      .filter((l) => l.source && l.target);
    nodesRef.current = nodes;
    linksRef.current = links;
    const sim = forceSimulation<SimNode>(nodes)
      .force("charge", forceManyBody().strength(-90))
      .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(45).strength(0.4))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius((d) => 6 + Math.sqrt(d.degree) * 2));
    let raf = 0;
    sim.on("tick", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setTick((t) => t + 1); }); });
    simRef.current = sim;
    return () => { sim.stop(); if (raf) cancelAnimationFrame(raf); };
  }, [data]);

  const areas = useMemo(() => [...new Set((data?.nodes ?? []).map((n) => n.area))], [data]);
  const maxDeg = useMemo(() => Math.max(1, ...(data?.nodes ?? []).map((n) => n.degree)), [data]);
  const q = query.trim().toLowerCase();
  const detail = selected ? nodeDetail(selected, nodesRef.current, linksRef.current) : null;

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * factor)) }));
  }
  function onBgPointerDown(e: React.PointerEvent) {
    const start = { x: e.clientX, y: e.clientY };
    const base = { ...view };
    const move = (ev: PointerEvent) => setView({ ...base, tx: base.tx + (ev.clientX - start.x), ty: base.ty + (ev.clientY - start.y) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function dragNode(node: SimNode, e: React.PointerEvent) {
    e.stopPropagation();
    const sim = simRef.current; if (sim) sim.alphaTarget(0.3).restart();
    const move = (ev: PointerEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      node.fx = (ev.clientX - rect.left - view.tx) / view.k * (W / rect.width);
      node.fy = (ev.clientY - rect.top - view.ty) / view.k * (H / rect.height);
    };
    const up = () => { node.fx = null; node.fy = null; if (sim) sim.alphaTarget(0); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  if (!data) return <div className="empty">building the code graph...</div>;
  if (data.nodes.length === 0) return <div className="empty">no code to graph</div>;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
        <input placeholder="search files..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, maxWidth: 280 }} />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{data.nodes.length} files, {data.edges.length} imports. scroll to zoom, drag to pan.</span>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "rgba(8,10,18,0.6)" }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", cursor: "grab", touchAction: "none" }} onWheel={onWheel} onPointerDown={onBgPointerDown}>
            <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
              {linksRef.current.map((l, i) => (
                <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} stroke="#222b3b" strokeWidth={0.6} />
              ))}
              {nodesRef.current.map((n) => {
                const r = 4 + Math.sqrt(n.degree) * 2.2;
                const dim = q.length > 0 && !n.label.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q);
                const isGod = n.degree >= maxDeg * 0.6 && n.degree > 3;
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer", opacity: dim ? 0.15 : 1 }}
                     onPointerDown={(e) => dragNode(n, e)} onClick={(e) => { e.stopPropagation(); setSelected(n.id); }}>
                    <circle r={r} fill={colorFor(n.area, areas)} stroke={isGod ? "#fff" : "rgba(0,0,0,0.4)"} strokeWidth={isGod ? 1.5 : 0.5} />
                    {(isGod || n.id === selected) && <text y={-r - 3} textAnchor="middle" fill="#f5f7fa" fontSize={8}>{n.label}</text>}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <div className="card" style={{ margin: 0 }}>
          {detail ? (
            <>
              <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{detail.id}</div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted-2)", margin: "4px 0 10px" }}>{detail.area} · {detail.degree} connections · {detail.symbols} symbols · {detail.lines} lines</div>
              {detail.imports.length > 0 && <><div style={{ fontSize: 10, color: "var(--emerald)" }}>IMPORTS</div>{detail.imports.map((i) => <div className="s" key={i}>{i}</div>)}</>}
              {detail.importedBy.length > 0 && <><div style={{ fontSize: 10, color: "var(--sky)", marginTop: 8 }}>IMPORTED BY</div>{detail.importedBy.map((i) => <div className="s" key={i}>{i}</div>)}</>}
            </>
          ) : <div className="empty">click a node to read its dependencies. White-ringed nodes are the god nodes everything flows through.</div>}
          <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            {areas.map((a) => <div key={a} style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(a, areas), display: "inline-block" }} />{a}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}

function nodeDetail(id: string, nodes: SimNode[], links: SimLink[]) {
  const node = nodes.find((n) => n.id === id)!;
  const imports = links.filter((l) => l.source.id === id).map((l) => l.target.label);
  const importedBy = links.filter((l) => l.target.id === id).map((l) => l.source.label);
  return { id, area: node.area, degree: node.degree, symbols: node.symbols, lines: node.lines, imports, importedBy };
}
