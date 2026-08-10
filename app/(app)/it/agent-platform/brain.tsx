"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  buildBrainTree,
  lifecycleBadge,
  type TreeAgent,
  type GraphWo,
  type BrainNode,
} from "@/lib/agent-library";

// The brain tree. A dendrogram, drawn with curved branches because the shape
// it is describing genuinely does branch rather than radiate: one trunk, a
// limb per area, a twig per agent.
//
// THE DUPLICATION IS DELIBERATE. eval-factuality appears under Enterprise
// (owned), under all three areas (inherited), and again at the evaluate stage
// of every work order it is assigned to. That is not redundancy, it is the
// answer to "where does this agent turn up?" — a question the web view can
// only answer by making you trace a dozen crossing lines. Click any copy and
// every copy lights.
//
// Positions come from a tidy-tree pass: leaves take the next free row,
// parents sit at the mean of their children. No force simulation, so nothing
// here depends on floating-point determinism the way the web view does.

const ROW = 26;
const LEVEL = 250;

type Placed = BrainNode & { x: number; y: number; depth: number };

function layout(root: BrainNode) {
  const placed: Placed[] = [];
  const links: { a: Placed; b: Placed }[] = [];
  let row = 0;

  const walk = (n: BrainNode, depth: number): Placed => {
    let y: number;
    const kids: Placed[] = [];
    if (n.children.length === 0) {
      y = row * ROW;
      row += 1;
    } else {
      for (const c of n.children) kids.push(walk(c, depth + 1));
      y = (kids[0].y + kids[kids.length - 1].y) / 2;
    }
    const me: Placed = { ...n, x: depth * LEVEL, y, depth };
    placed.push(me);
    for (const k of kids) links.push({ a: me, b: k });
    return me;
  };

  walk(root, 0);
  return { placed, links, rows: row };
}

/** A branch: horizontal out of the parent, curve, horizontal into the child. */
function branch(a: Placed, b: Placed) {
  const mx = a.x + (b.x - a.x) * 0.55;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function BrainTree({
  agents,
  workOrders,
  tiers,
}: {
  agents: TreeAgent[];
  workOrders: GraphWo[];
  /** work order id -> risk tier, for the evaluator panel at `evaluate`. */
  tiers: Record<string, string | null>;
}) {
  const [openWo, setOpenWo] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // an agent_id
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement>(null);

  const tierMap = useMemo(
    () => new Map(Object.entries(tiers)),
    [tiers],
  );
  const tree = useMemo(
    () => buildBrainTree(agents, workOrders, openWo, tierMap),
    [agents, workOrders, openWo, tierMap],
  );
  const { placed, links, rows } = useMemo(() => layout(tree), [tree]);

  const lit = hover ?? picked;
  /** How many times the lit agent appears. The number is the whole point. */
  const copies = useMemo(
    () => (lit ? placed.filter((p) => p.agentId === lit).length : 0),
    [lit, placed],
  );
  const selAgent = useMemo(
    () => (picked ? agents.find((a) => a.agent_id === picked) : undefined),
    [picked, agents],
  );
  const whereItAppears = useMemo(() => {
    if (!picked) return [];
    return placed
      .filter((p) => p.agentId === picked)
      .map((p) => (p.wo ? `${p.wo} · ${p.label === picked ? "acting" : p.label}` : (p.sub || "")))
      .filter(Boolean);
  }, [picked, placed]);

  const width = useMemo(
    () => Math.max(...placed.map((p) => p.x)) + LEVEL,
    [placed],
  );
  const height = rows * ROW + ROW * 2;

  function fit() {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r?.width) return 1;
    return Math.min(r.width / width, r.height / height);
  }
  function onDown(ev: React.PointerEvent<SVGSVGElement>) {
    if (ev.target instanceof Element && ev.target.closest(".btnode")) return;
    drag.current = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function onMove(ev: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const k = 1 / fit();
    setPan({ x: d.px + (ev.clientX - d.x) * k, y: d.py + (ev.clientY - d.y) * k });
  }
  function onUp(ev: React.PointerEvent<SVGSVGElement>) {
    if (drag.current) ev.currentTarget.releasePointerCapture(ev.pointerId);
    drag.current = null;
  }

  if (agents.length === 0)
    return (
      <p className="note">
        No agents registered — migration <code>0018_agent_library.sql</code> has
        not been run, so there is no tree to grow.
      </p>
    );

  return (
    <>
      <div className="mmbar">
        <span className="btcount">
          {placed.filter((p) => p.kind === "agent").length} agent placements ·{" "}
          {agents.length} distinct agents
        </span>
        <span className="mmspace" />
        {(picked || openWo) && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setPicked(null);
              setOpenWo(null);
            }}
          >
            Clear
          </button>
        )}
        <button type="button" className="chip" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>
          +
        </button>
        <button type="button" className="chip" onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))}>
          −
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset view
        </button>
      </div>

      {lit && (
        <p className="btlit">
          <code>{lit}</code> appears <b>{copies}</b> time{copies === 1 ? "" : "s"}{" "}
          in this tree
          {copies > 1 && " — every copy is lit"}.
        </p>
      )}

      <div className="mmwrap">
        <svg
          ref={svgRef}
          className="mmsvg btsvg"
          viewBox={`${-160 + pan.x} ${-ROW + pan.y} ${(width + 200) / zoom} ${height / zoom}`}
          role="img"
          aria-label="Brain tree of the agent library — agents repeated at every place they appear"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {links.map((l, i) => {
            const on =
              !lit || l.a.agentId === lit || l.b.agentId === lit;
            return (
              <path
                key={i}
                className={`btlink${on ? "" : " dim"}`}
                d={branch(l.a, l.b)}
              />
            );
          })}

          {placed.map((p) => {
            const isAgent = p.kind === "agent";
            const on = !lit || p.agentId === lit;
            const cls = [
              "btnode",
              `btk-${p.kind}`,
              p.tone ? `btt-${p.tone}` : "",
              on ? "" : "dim",
              isAgent && p.agentId === picked ? "sel" : "",
              isAgent && p.agent?.enabled === false ? "bt-off" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                key={p.id}
                className={cls}
                transform={`translate(${p.x} ${p.y})`}
                onMouseEnter={() => isAgent && setHover(p.agentId ?? null)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (p.kind === "wo")
                    setOpenWo((v) => (v === p.id.slice(4) ? null : p.id.slice(4)));
                  else if (isAgent) setPicked((v) => (v === p.agentId ? null : p.agentId!));
                }}
                tabIndex={isAgent || p.kind === "wo" ? 0 : -1}
                role={isAgent || p.kind === "wo" ? "button" : undefined}
                onKeyDown={(ev) => {
                  if (ev.key !== "Enter" && ev.key !== " ") return;
                  ev.preventDefault();
                  if (p.kind === "wo")
                    setOpenWo((v) => (v === p.id.slice(4) ? null : p.id.slice(4)));
                  else if (isAgent) setPicked((v) => (v === p.agentId ? null : p.agentId!));
                }}
              >
                <title>
                  {p.label}
                  {p.sub ? `\n${p.sub}` : ""}
                </title>
                <circle className="btdot" r={p.kind === "root" ? 7 : isAgent ? 4.5 : 5.5} />
                <text className="bttext" x={9} y={3.5}>
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        <aside className="mmside">
          {!selAgent ? (
            <div className="mmempty">
              <p>
                <b>Click an agent</b> and every copy of it lights up at once —
                under Enterprise where it is owned, under each area that
                inherits it, and at every work-order stage where it acts.
              </p>
              <p className="note" style={{ marginTop: 10 }}>
                <b>Click a work order</b> to unfold its whole path, intake
                through to closed, with the agents named at the stage they act
                in. That is one session from kickoff to finish.
              </p>
            </div>
          ) : (
            <>
              <div className="mmhead">
                <code>{selAgent.agent_id}</code>
                <span className={`badge ${lifecycleBadge(selAgent.lifecycle)}`}>
                  {selAgent.lifecycle ?? selAgent.source}
                </span>
              </div>
              {selAgent.question && <p className="mmq">{selAgent.question}</p>}
              <h4 className="mmh4">Appears {copies} times</h4>
              <ul className="mmwos">
                {whereItAppears.slice(0, 14).map((w, i) => (
                  <li key={i} className="btwhere">
                    {w}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 12 }}>
                <Link
                  href={`/it/agent-platform?tab=wos&agent=${encodeURIComponent(selAgent.agent_id)}`}
                  className="addbtn"
                >
                  Open its work orders
                </Link>
              </p>
            </>
          )}
        </aside>
      </div>

      <p className="legend mmlegend">
        <span>
          <i className="btkey btt-home" /> owned here
        </span>
        <span>
          <i className="btkey btt-inherited" /> inherited from Enterprise
        </span>
        <span>
          <i className="btkey btt-gate" /> deterministic gate
        </span>
        <span>
          <i className="btkey btt-human" /> human
        </span>
      </p>

      <p className="note">
        <b>The repetition is the design, not a bug in it.</b> The web view
        draws each agent once and lets a dozen lines leave it, which is honest
        but unreadable. Here an agent appears once per place it actually turns
        up, so no branch ever crosses another and you can follow one with a
        finger. What that trade costs is the count — so clicking restores it,
        by lighting every copy and saying how many there are.
      </p>
    </>
  );
}
