"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  buildAgentGraph,
  lifecycleBadge,
  CTX_TITLES,
  type TreeAgent,
  type GraphWo,
  type GraphNode,
  type GraphEdge,
} from "@/lib/agent-library";

// The mind map. Same facts as the tree beneath it, drawn as a graph so that
// the thing a tree cannot show becomes visible: two agents reaching the same
// context page, and an agent doing work outside the area that owns it.
//
// THE EDGES ARE NOT A CALL GRAPH. No agent knows who comes after it — every
// output returns to the orchestrator. So there is deliberately no
// agent → agent edge anywhere in here. Agents connect THROUGH a shared
// context page or a shared product area, which is the only kind of
// connection the architecture actually has. Sequence is the pipeline's
// story and stays on its own diagram.
//
// No charting library and no CDN: the layout is ~50 lines of force
// simulation below, seeded deterministically so the server and the client
// render the same picture and hydration matches.

const LAYER_CLASS: Record<string, string> = {
  enterprise: "mm-enterprise",
  department: "mm-department",
  product: "mm-product",
  unfiled: "mm-unfiled",
};

// Determinism here is a hydration requirement, and it is narrower than it
// looks. A seeded PRNG is not enough: ECMAScript leaves the precision of
// Math.cos, Math.sin and Math.hypot to the implementation, so Node and the
// browser disagree in the last bits and React reports a mismatch on every
// coordinate. Everything below is therefore built from +, - , * , / and
// Math.sqrt, which IEEE 754 pins exactly — and the one place trigonometry is
// genuinely convenient (initial placement) is rounded hard enough to erase
// the difference before it can propagate.
const Q = 1e4;
const quant = (v: number) => Math.round(v * Q) / Q;

/** Deterministic PRNG — Math.random() here would desync SSR and hydration. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number };

// Distances are generous on purpose. Agent ids are long — a label like
// gov-compliance-reviewer is far wider than the dot it belongs to — so the
// layout is spread until labels mostly clear each other at the default zoom.
// The remainder is handled by a halo behind the text (see .mmtext) and by
// zoom, the same way any graph view of this size has to.

/** Ideal edge length by kind — context pages sit further out than owners. */
const REST: Record<GraphEdge["kind"], number> = {
  owns: 135,
  context: 210,
  work: 230,
};

/** Where a node starts, before any force is applied. */
const RING: Record<GraphNode["kind"], number> = {
  root: 0,
  layer: 160,
  group: 285,
  agent: 445,
  ctx: 630,
};

function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  const rand = rng(0x5c007);
  const pos = new Map<string, Pt>();
  const vel = new Map<string, Pt>();
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  nodes.forEach((n, i) => {
    const r = RING[n.kind];
    const a = i * GOLDEN + rand() * 0.45;
    pos.set(n.id, {
      x: quant(Math.cos(a) * r + (rand() - 0.5) * 22),
      y: quant(Math.sin(a) * r + (rand() - 0.5) * 22),
    });
    vel.set(n.id, { x: 0, y: 0 });
  });

  const REPULSION = 21000;
  const SPRING = 0.021;
  const GRAVITY = 0.011;
  const DAMPING = 0.82;

  for (let step = 0; step < 480; step++) {
    // Cooling: large corrections early, fine settling late.
    const heat = Math.max(0.12, 1 - step / 480);

    for (let i = 0; i < nodes.length; i++) {
      const a = pos.get(nodes[i].id)!;
      const va = vel.get(nodes[i].id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = pos.get(nodes[j].id)!;
        const vb = vel.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // Coincident: nudge apart deterministically rather than dividing
          // by zero and flinging both to infinity.
          dx = (rand() - 0.5) * 2;
          dy = (rand() - 0.5) * 2;
          d2 = dx * dx + dy * dy || 1;
        }
        const d = Math.sqrt(d2);
        const f = (REPULSION / d2) * heat;
        const ux = (dx / d) * f;
        const uy = (dy / d) * f;
        va.x += ux;
        va.y += uy;
        vb.x -= ux;
        vb.y -= uy;
      }
      // Gravity — without it, disconnected components drift off the canvas.
      va.x -= a.x * GRAVITY;
      va.y -= a.y * GRAVITY;
    }

    for (const e of edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const va = vel.get(e.source)!;
      const vb = vel.get(e.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - REST[e.kind]) * SPRING * heat;
      const ux = (dx / d) * f;
      const uy = (dy / d) * f;
      va.x += ux;
      va.y += uy;
      vb.x -= ux;
      vb.y -= uy;
    }

    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const v = vel.get(n.id)!;
      v.x *= DAMPING;
      v.y *= DAMPING;
      // Speed clamp — one bad frame otherwise throws a node into orbit.
      // sqrt, not hypot: hypot's precision is implementation-defined.
      const sp = Math.sqrt(v.x * v.x + v.y * v.y);
      if (sp > 30) {
        v.x = (v.x / sp) * 30;
        v.y = (v.y / sp) * 30;
      }
      if (n.kind === "root") continue; // the root anchors the picture
      p.x += v.x;
      p.y += v.y;
    }
  }

  // Quantised once more on the way out: the numbers become attribute strings
  // in the HTML, and four decimals of a pixel is already more than the
  // renderer can use.
  for (const p of pos.values()) {
    p.x = quant(p.x);
    p.y = quant(p.y);
  }
  return pos;
}

function radius(kind: GraphNode["kind"], degree: number) {
  if (kind === "root") return 15;
  if (kind === "layer") return 12;
  if (kind === "group") return 10;
  if (kind === "ctx") return 5 + Math.min(5, degree * 0.55);
  return 6 + Math.min(6, degree * 0.7);
}

export function AgentGraph({
  agents,
  workOrders,
}: {
  agents: TreeAgent[];
  workOrders: GraphWo[];
}) {
  const { nodes, edges } = useMemo(
    () => buildAgentGraph(agents, workOrders),
    [agents, workOrders],
  );
  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(true);
  const [showContext, setShowContext] = useState(true);
  // How many hops out from the clicked dot to light up. The closure is not
  // interesting as a yes/no: CTX-001 is loaded by almost every agent, so
  // "everything reachable" is very nearly the whole graph within two hops.
  // What carries the information is the DISTANCE, so depth is adjustable and
  // every level is shaded differently.
  const [depth, setDepth] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  /** Dots the reader has dragged. Overrides the computed layout, per node. */
  const [moved, setMoved] = useState<Map<string, Pt>>(new Map());
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeDrag = useRef<{
    id: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  /** Did this pointer sequence move a dot? If so, it was a drag, not a click. */
  const didDrag = useRef(false);
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    captured?: boolean;
  } | null>(null);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const visibleEdges = useMemo(
    () => (showContext ? edges : edges.filter((e) => e.kind !== "context")),
    [edges, showContext],
  );
  // Hiding the context edges hides the pages with them — otherwise eleven
  // unreachable dots stay on the canvas looking like agents nobody owns.
  // Positions are NOT recomputed, so the rest of the map holds still.
  const visibleNodes = useMemo(
    () => (showContext ? nodes : nodes.filter((n) => n.kind !== "ctx")),
    [nodes, showContext],
  );

  // Adjacency over the edges actually drawn, so hiding context edges also
  // narrows what counts as "connected".
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const put = (a: string, b: string) => {
      const s = m.get(a);
      if (s) s.add(b);
      else m.set(a, new Set([b]));
    };
    for (const e of visibleEdges) {
      put(e.source, e.target);
      put(e.target, e.source);
    }
    return m;
  }, [visibleEdges]);

  const active = hovered ?? selected;
  // Breadth-first from the focused dot, keeping the hop count. Null means
  // nothing is focused, so nothing dims. A node absent from the map is
  // unreachable within `depth` and dims out entirely.
  const dist = useMemo(() => {
    if (!focusMode || !active) return null;
    const d = new Map<string, number>([[active, 0]]);
    let frontier = [active];
    while (frontier.length) {
      const next: string[] = [];
      for (const cur of frontier) {
        const dc = d.get(cur)!;
        if (dc >= depth) continue;
        for (const nb of neighbours.get(cur) ?? []) {
          if (!d.has(nb)) {
            d.set(nb, dc + 1);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
    return d;
  }, [focusMode, active, neighbours, depth]);

  /** Reachable agents grouped by hop, for the inspector. */
  const reachByHop = useMemo(() => {
    if (!dist) return [];
    const byHop = new Map<number, string[]>();
    for (const [id, h] of dist) {
      if (h === 0) continue;
      const n = nodeById.get(id);
      if (n?.kind !== "agent") continue;
      const arr = byHop.get(h);
      if (arr) arr.push(id);
      else byHop.set(h, [id]);
    }
    return [...byHop.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hop, ids]) => ({ hop, ids: ids.sort() }));
  }, [dist, nodeById]);

  /** Where a dot actually is: where the reader put it, else where the
   *  simulation put it. */
  const posOf = (id: string): Pt => moved.get(id) ?? pos.get(id)!;

  // NOTE: the viewBox is deliberately computed from the ORIGINAL layout and
  // not from dragged positions. If it tracked them it would rescale mid-drag,
  // and a dot that rescales while you are holding it does not stay under the
  // cursor. Drag something off the edge and zoom out or pan to follow it.
  const view = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = 70;
    return {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }, [nodes, pos]);

  const sel = selected ? nodeById.get(selected) : undefined;
  const selAgent = sel?.kind === "agent" ? sel.agent : undefined;
  const selWos = selAgent
    ? workOrders.filter((w) => w.agent === selAgent.agent_id)
    : [];

  // Cross-area work, listed as well as drawn: an edge you have to hunt for
  // on a graph is not really surfaced.
  const crossings = useMemo(
    () =>
      edges
        .filter((e) => e.kind === "work")
        .map((e) => ({
          agent: e.source,
          area: nodeById.get(e.target)?.label ?? e.target,
          n: e.n ?? 1,
        }))
        .sort((a, b) => b.n - a.n),
    [edges, nodeById],
  );

  function onWheel(ev: React.WheelEvent<SVGSVGElement>) {
    ev.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.4, z * (ev.deltaY < 0 ? 1.12 : 0.89))));
  }
  // Screen pixels per viewBox unit. preserveAspectRatio defaults to
  // xMidYMid meet, so the scale is uniform and is the SMALLER of the two
  // ratios — the axis that has to fit.
  function fitScale() {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r?.width || !r?.height) return 1;
    return Math.min(r.width / view.w, r.height / view.h);
  }

  // Panning deliberately does NOT capture the pointer when the press lands on
  // a node. Pointer capture retargets the compatibility mouse events to the
  // capturing element, so an SVG-wide capture sends every click to the svg and
  // no dot is ever clickable. Pressing the background still captures, which is
  // what keeps a pan smooth when the cursor runs outside the canvas.
  function onPointerDown(ev: React.PointerEvent<SVGSVGElement>) {
    const el = ev.target instanceof Element ? ev.target.closest(".mmnode") : null;
    const id = el?.getAttribute("data-id");
    didDrag.current = false;
    if (id) {
      const p = posOf(id);
      nodeDrag.current = { id, x: ev.clientX, y: ev.clientY, ox: p.x, oy: p.y };
      return;
    }
    drag.current = {
      x: ev.clientX,
      y: ev.clientY,
      px: pan.x,
      py: pan.y,
      captured: true,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev: React.PointerEvent<SVGSVGElement>) {
    const fit = fitScale();
    const nd = nodeDrag.current;
    if (nd) {
      const dx = ev.clientX - nd.x;
      const dy = ev.clientY - nd.y;
      // A few pixels of slop, so a slightly unsteady click still selects
      // rather than nudging the dot and swallowing the click.
      if (!didDrag.current && Math.abs(dx) + Math.abs(dy) < 4) return;
      didDrag.current = true;
      // The node's coordinates live INSIDE scale(zoom), so a pixel of cursor
      // travel is 1/(fit·zoom) units here.
      const k = 1 / (fit * zoom);
      setMoved((m) =>
        new Map(m).set(nd.id, { x: nd.ox + dx * k, y: nd.oy + dy * k }),
      );
      return;
    }
    const d = drag.current;
    if (!d) return;
    // Pan is applied OUTSIDE scale(zoom), so it does not divide by zoom —
    // which the previous version did, making a pan drift from the cursor at
    // any zoom other than 1.
    const k = 1 / fit;
    setPan({ x: d.px + (ev.clientX - d.x) * k, y: d.py + (ev.clientY - d.y) * k });
  }

  function onPointerUp(ev: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.captured)
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    drag.current = null;
    nodeDrag.current = null;
  }

  if (nodes.length <= 1) {
    return (
      <p className="note">
        Nothing to map — migration <code>0018_agent_library.sql</code> has not
        been run, so there are no agents to draw.
      </p>
    );
  }

  return (
    <>
      <div className="mmbar">
        <button
          type="button"
          className={`chip${focusMode ? " on" : ""}`}
          aria-pressed={focusMode}
          onClick={() => setFocusMode((v) => !v)}
        >
          {focusMode ? "◉" : "○"} Highlight &amp; dim
        </button>
        <button
          type="button"
          className={`chip${showContext ? " on" : ""}`}
          aria-pressed={showContext}
          onClick={() => {
            setShowContext((v) => {
              // Do not leave the inspector describing a page that is no
              // longer on the canvas.
              if (v && nodeById.get(selected ?? "")?.kind === "ctx")
                setSelected(null);
              return !v;
            });
          }}
        >
          Shared context pages
        </button>
        <span className="mmdepth">
          <span className="mmdepth-l">levels</span>
          {[1, 2, 3, 4, 9].map((d) => (
            <button
              key={d}
              type="button"
              className={`chip mmd${depth === d ? " on" : ""}`}
              aria-pressed={depth === d}
              title={
                d === 9
                  ? "Every node reachable from the selected dot"
                  : `Up to ${d} hop${d === 1 ? "" : "s"} away`
              }
              onClick={() => setDepth(d)}
            >
              {d === 9 ? "all" : d}
            </button>
          ))}
        </span>
        <span className="mmspace" />
        <button type="button" className="chip" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>
          +
        </button>
        <button type="button" className="chip" onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}>
          −
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setSelected(null);
            setMoved(new Map());
          }}
          title="Zoom, pan, selection, and any dots you have dragged"
        >
          Reset
        </button>
        {moved.size > 0 && (
          <button
            type="button"
            className="chip"
            onClick={() => setMoved(new Map())}
            title="Put the dragged dots back where the layout put them"
          >
            ↺ layout ({moved.size})
          </button>
        )}
      </div>

      <div className="mmwrap">
        <svg
          ref={svgRef}
          className="mmsvg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="img"
          aria-label="Agent mind map — enterprise to department to product, with shared context pages and cross-area work"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g
            transform={`translate(${pan.x} ${pan.y}) scale(${zoom}) translate(${
              (view.x + view.w / 2) * (1 / zoom - 1)
            } ${(view.y + view.h / 2) * (1 / zoom - 1)})`}
          >
            {visibleEdges.map((e, i) => {
              const a = posOf(e.source);
              const b = posOf(e.target);
              if (!a || !b) return null;
              // An edge lights only if BOTH ends were reached and they sit on
              // consecutive rings — an edge between two same-hop nodes is not
              // part of how the focus spreads, and drawing it muddies the
              // ripple that makes the levels readable.
              const ds = dist?.get(e.source);
              const dt = dist?.get(e.target);
              const on =
                !dist ||
                (ds !== undefined && dt !== undefined && Math.abs(ds - dt) === 1);
              const hop = on && dist ? Math.max(ds!, dt!) : 0;
              return (
                <line
                  key={`${e.source}-${e.target}-${e.kind}-${i}`}
                  className={`mmedge mme-${e.kind}${on ? "" : " dim"}${
                    on && dist ? ` h${Math.min(hop, 4)}` : ""
                  }`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={e.kind === "work" ? 1.2 + Math.min(3, (e.n ?? 1) * 0.8) : undefined}
                />
              );
            })}

            {visibleNodes.map((n) => {
              const p = posOf(n.id);
              const hop = dist?.get(n.id);
              const dimmed = dist ? hop === undefined : false;
              const r = radius(n.kind, degree.get(n.id) ?? 0);
              const isSel = selected === n.id;
              const cls = [
                "mmnode",
                `mmk-${n.kind}`,
                n.kind === "agent" ? LAYER_CLASS[n.layer ?? "unfiled"] : "",
                n.kind === "agent" && n.agent?.enabled === false ? "mm-off" : "",
                dimmed ? "dim" : "",
                hop !== undefined ? `h${Math.min(hop, 4)}` : "",
                isSel ? "sel" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const title =
                n.kind === "agent"
                  ? `${n.label}\n${n.agent?.question ?? ""}\n${n.agent?.lifecycle ?? ""}${
                      n.agent?.risk_ceiling ? ` · ceiling ${n.agent.risk_ceiling}` : ""
                    }`
                  : n.kind === "ctx"
                    ? `${n.label} — ${CTX_TITLES[n.id] ?? "context page"}`
                    : n.label;
              return (
                <g
                  key={n.id}
                  data-id={n.id}
                  className={cls}
                  transform={`translate(${p.x} ${p.y})`}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    // A drag ends in a click on the same element. Consume it,
                    // or repositioning a dot would also select or deselect it.
                    if (didDrag.current) {
                      didDrag.current = false;
                      return;
                    }
                    setSelected((s) => (s === n.id ? null : n.id));
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={title}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected((s) => (s === n.id ? null : n.id));
                    }
                  }}
                >
                  <title>{title}</title>
                  <circle className="mmdot" r={r} />
                  <text className="mmtext" y={r + 11}>
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <aside className="mmside">
          {!sel ? (
            <div className="mmempty">
              <p>
                <b>Click a dot.</b> An agent opens its work here, with a link
                into the work order itself so you can read the entries above and
                below it.
              </p>
              <p className="note" style={{ marginTop: 10 }}>
                Hover to light up one agent and everything it reaches, shaded by
                how many hops away. <b>Drag any dot</b> to arrange the map the
                way you want it; drag the background to pan, and scroll to zoom.
                Reset puts everything back.
              </p>
            </div>
          ) : selAgent ? (
            <>
              <div className="mmhead">
                <code>{selAgent.agent_id}</code>
                <span className={`badge ${lifecycleBadge(selAgent.lifecycle)}`}>
                  {selAgent.lifecycle ?? selAgent.source}
                </span>
              </div>
              {selAgent.question && <p className="mmq">{selAgent.question}</p>}
              <dl className="mmkv">
                <div>
                  <dt>Layer</dt>
                  <dd>
                    {selAgent.layer ?? "—"}
                    {selAgent.department ? ` · ${selAgent.department}` : ""}
                    {selAgent.product_name ? ` · ${selAgent.product_name}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Owns</dt>
                  <dd>{selAgent.owns_object ?? "—"}</dd>
                </div>
                <div>
                  <dt>Risk ceiling</dt>
                  <dd>{selAgent.risk_ceiling ?? "—"}</dd>
                </div>
              </dl>

              <h4 className="mmh4">
                Work orders ({selWos.length})
              </h4>
              {selWos.length === 0 ? (
                <p className="note" style={{ marginTop: 0 }}>
                  None recorded. This agent has a spec and a place in the
                  library, but nothing has been run through it yet — so there is
                  no session to read.
                </p>
              ) : (
                <ul className="mmwos">
                  {selWos.slice(0, 8).map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/it/agent-platform?tab=wos&wo=${encodeURIComponent(w.id)}`}
                        className="mmwo"
                      >
                        <span className="mmwo-t">{w.title}</span>
                        <span className="mmwo-m">
                          <code>{w.wo_code ?? "—"}</code> · {w.stage ?? w.status}
                          {w.product_name ? ` · ${w.product_name}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {reachByHop.length > 0 && (
                <>
                  <h4 className="mmh4" style={{ marginTop: 14 }}>
                    Reaches, by hop
                  </h4>
                  {reachByHop.map(({ hop, ids }) => (
                    <div key={hop} className={`mmhop h${Math.min(hop, 4)}`}>
                      <span className="mmhop-n">{hop}</span>
                      <span className="mmhop-ids">
                        {ids.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="mmlink"
                            onClick={() => setSelected(id)}
                          >
                            {id}
                          </button>
                        ))}
                      </span>
                    </div>
                  ))}
                  <p className="note" style={{ marginTop: 6 }}>
                    Hop 1 is a direct link. Beyond that the path runs{" "}
                    <i>through</i> something — usually a shared context page —
                    so a distant agent is not one this agent talks to. It is one
                    that would be affected by the same change.
                  </p>
                </>
              )}

              <p style={{ marginTop: 12 }}>
                <Link
                  href={`/it/agent-platform?tab=wos&agent=${encodeURIComponent(selAgent.agent_id)}`}
                  className="addbtn"
                >
                  Open this agent&apos;s work orders
                </Link>
              </p>
              {selAgent.blocked_reason && (
                <p className="note" style={{ color: "var(--warn)" }}>
                  {selAgent.blocked_reason}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mmhead">
                <b>{sel.label}</b>
                <span className="badge b-reg">{sel.kind}</span>
              </div>
              <p className="mmq">
                {sel.kind === "ctx"
                  ? (CTX_TITLES[sel.id] ??
                    "A context page in docs/agents/context/.")
                  : sel.kind === "group"
                    ? "An area. The agents linked to it are the ones it owns; a coloured line means an agent from elsewhere did work here."
                    : sel.kind === "layer"
                      ? "A governance layer."
                      : "The enterprise root."}
              </p>
              {sel.kind === "ctx" && (
                <>
                  <h4 className="mmh4">
                    Loaded by ({(neighbours.get(sel.id) ?? new Set()).size})
                  </h4>
                  <ul className="mmwos">
                    {[...(neighbours.get(sel.id) ?? [])].sort().map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          className="mmlink"
                          onClick={() => setSelected(id)}
                        >
                          <code>{id}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="note">
                    Every agent above reads this same page. Change it and all of
                    them change — which is the point of a shared context page,
                    and the reason this is the edge worth watching.
                  </p>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      <p className="legend mmlegend">
        <span>
          <i className="mmkey mm-enterprise" /> enterprise agent
        </span>
        <span>
          <i className="mmkey mm-department" /> department agent
        </span>
        <span>
          <i className="mmkey mm-product" /> product agent
        </span>
        <span>
          <i className="mmkey mmkey-ctx" /> context page
        </span>
        <span>
          <i className="mmkey mmkey-line mme-owns" /> owns
        </span>
        <span>
          <i className="mmkey mmkey-line mme-context" /> loads this page
        </span>
        <span>
          <i className="mmkey mmkey-line mme-work" /> worked outside its own area
        </span>
      </p>

      <h3 className="mmh3">Where agents cross into another area</h3>
      {crossings.length === 0 ? (
        <p className="note" style={{ marginTop: 0 }}>
          <b>No crossings are recorded</b> — which is not the same as none
          having happened. This edge is drawn from work orders that name both an
          agent and a product, and{" "}
          {workOrders.length === 0
            ? "there are no work orders on this database yet"
            : `none of the ${workOrders.length} work orders here put an agent outside the area that owns it`}
          . The map shows what the ledger records, and nothing else.
        </p>
      ) : (
        <>
          <ul className="mmcross">
            {crossings.map((c) => (
              <li key={`${c.agent}-${c.area}`}>
                <button
                  type="button"
                  className="mmlink"
                  onClick={() => setSelected(c.agent)}
                >
                  <code>{c.agent}</code>
                </button>{" "}
                → <b>{c.area}</b>{" "}
                <span className="mmn">
                  {c.n} work order{c.n === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
          <p className="note">
            A crossing is not a fault. A shared agent loading a product context
            page is the design working — the library stays at sixteen agents
            precisely because Education and Soundwiserx reuse them. It is worth
            seeing because it is where a change to one product&apos;s context
            can reach the other&apos;s output.
          </p>
        </>
      )}
    </>
  );
}
