"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  openWorkOrder,
  advanceWorkOrder,
  approveWorkOrder,
  recordEvent,
  type WoState,
} from "./actions";
import {
  RISK_TIERS,
  STAGES,
  STAGE_BY_ID,
  LIVE_STAGES,
  EVALUATORS_BY_TIER,
  TIER_NOTE,
  ACTOR_LABEL,
  stageIndex,
  tierTag,
  type RiskTier,
} from "@/lib/agent-library";
import { useCloseOnSuccess } from "../../use-close-on-success";

const initial: WoState = { error: null, success: false };

export type WoAgent = {
  agent_id: string;
  risk_ceiling: string | null;
  lifecycle: string | null;
  enabled: boolean | null;
  blocked_reason: string | null;
};

export type Wo = {
  id: string;
  wo_code: string | null;
  agent: string | null;
  title: string;
  objective: string | null;
  status: string;
  stage: string | null;
  risk_tier: string | null;
  audience: string | null;
  channel: string | null;
  data_classes: string | null;
  product_id: string | null;
  budget_ceiling_usd: number | null;
  requester_email: string | null;
  approved_by: string | null;
  approved_at: string | null;
  remediation_rounds: number;
  cost_usd: number | null;
  created_at: string;
  closed_at: string | null;
  source: string;
};

export type WoEvent = {
  id: string;
  work_order_id: string;
  seq: number;
  kind: string;
  from_stage: string | null;
  to_stage: string | null;
  actor: string;
  actor_id: string | null;
  outcome: string | null;
  detail: string | null;
  cost_usd: number | null;
  created_by_email: string | null;
  created_at: string;
};

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(Math.abs(Number(n)) < 1 ? 4 : 2)}`;

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------

export function OpenWorkOrder({
  agents,
  products,
}: {
  agents: WoAgent[];
  products: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<RiskTier>("low");
  const [state, action, pending] = useActionState(openWorkOrder, initial);
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open)
    return (
      <p>
        <button type="button" className="addbtn" onClick={() => setOpen(true)}>
          Open a work order
        </button>
      </p>
    );

  const evaluators = EVALUATORS_BY_TIER[tier];

  return (
    <form action={action} className="formcard">
      <div className="field-row">
        <div className="field">
          <label htmlFor="wo-agent">Agent</label>
          <select id="wo-agent" name="agent" required defaultValue="">
            <option value="" disabled>
              Choose an agent…
            </option>
            {agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.agent_id}
                {a.risk_ceiling ? ` · ceiling ${a.risk_ceiling}` : ""}
                {a.enabled === false ? " · not enabled" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wo-tier">Risk tier</label>
          <select
            id="wo-tier"
            name="risk_tier"
            required
            value={tier}
            onChange={(e) => setTier(e.target.value as RiskTier)}
          >
            {RISK_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wo-product">Product</label>
          <select id="wo-product" name="product_id" defaultValue="">
            <option value="">Company-wide</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="wo-title">Title</label>
          <input
            id="wo-title"
            name="title"
            required
            maxLength={140}
            placeholder="Draft the August pilot article"
          />
        </div>
        <div className="field">
          <label htmlFor="wo-data">Data classes</label>
          <input
            id="wo-data"
            name="data_classes"
            required
            maxLength={40}
            placeholder="D0, D1"
            list="wo-data-classes"
          />
          <datalist id="wo-data-classes">
            <option value="D0" />
            <option value="D0, D1" />
            <option value="D0, D1, D2" />
          </datalist>
        </div>
      </div>

      <div className="field">
        <label htmlFor="wo-objective">Objective</label>
        <textarea
          id="wo-objective"
          name="objective"
          required
          rows={2}
          maxLength={600}
          placeholder="What is this work order trying to achieve? Intake does not infer this."
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="wo-audience">Audience</label>
          <input
            id="wo-audience"
            name="audience"
            maxLength={80}
            placeholder="Teachers"
          />
        </div>
        <div className="field">
          <label htmlFor="wo-channel">Channel</label>
          <input
            id="wo-channel"
            name="channel"
            maxLength={80}
            placeholder="Blog"
          />
        </div>
        <div className="field">
          <label htmlFor="wo-budget">Budget ceiling (USD)</label>
          <input
            id="wo-budget"
            name="budget_ceiling_usd"
            type="number"
            step="0.01"
            min="0"
            placeholder="2.50"
          />
        </div>
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        <b>{tier}</b> — {TIER_NOTE[tier]}
        {evaluators.length > 0 && (
          <>
            {" "}
            Evaluators required:{" "}
            {evaluators.map((e) => (
              <code key={e} style={{ marginRight: 6 }}>
                {e}
              </code>
            ))}
          </>
        )}
      </p>

      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Opening…" : "Open work order"}
      </button>
      <button
        type="button"
        className="addbtn2"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        Cancel
      </button>
      {state.error && <p className="err">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------
// The stage track
// ---------------------------------------------------------------------

function StageTrack({
  stage,
  blockedAt,
}: {
  stage: string | null;
  blockedAt?: string | null;
}) {
  const at = stageIndex(stage, blockedAt);
  const terminal = stage === "closed" || stage === "blocked";

  return (
    <div className="wotrack">
      {LIVE_STAGES.map((s, i) => {
        const cls =
          stage === "closed"
            ? "done"
            : i < at
              ? "done"
              : i === at
                ? stage === "blocked"
                  ? "blockedstep"
                  : "now"
                : "todo";
        return (
          <span
            key={s.id}
            className={`wostep ${cls}${s.actor === "gate" ? " gate" : ""}`}
            title={`${s.label} — ${ACTOR_LABEL[s.actor]}${s.gate ? ` · ${s.gate}` : ""}\n${s.exit}`}
          >
            {s.label}
          </span>
        );
      })}
      {terminal && (
        <span className={`wostep ${stage === "closed" ? "done" : "blockedstep"}`}>
          {stage === "closed" ? "Closed" : "Blocked"}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// One work order
// ---------------------------------------------------------------------

export function WorkOrderCard({
  wo,
  events,
  canWrite,
  productName,
  focused = false,
}: {
  wo: Wo;
  events: WoEvent[];
  canWrite: boolean;
  productName: string | null;
  /** Arrived here from a dot on the map — open the feed and scroll to it. */
  focused?: boolean;
}) {
  // Feed starts open when this is the card the link named, so the entries
  // above and below the one you came for are already on screen.
  const [openFeed, setOpenFeed] = useState(focused);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focused]);

  const [advState, advAction, advPending] = useActionState(
    advanceWorkOrder,
    initial,
  );
  const [appState, appAction, appPending] = useActionState(
    approveWorkOrder,
    initial,
  );
  const [evState, evAction, evPending] = useActionState(recordEvent, initial);
  const [noting, setNoting] = useState(false);
  useCloseOnSuccess(evState, () => setNoting(false));

  const def = wo.stage ? STAGE_BY_ID.get(wo.stage as never) : undefined;
  const nexts = def?.next ?? [];
  const terminal = wo.stage === "closed" || wo.stage === "blocked";
  const feedCost = events.reduce((s, e) => s + Number(e.cost_usd ?? 0), 0);
  const spent = Number(wo.cost_usd ?? 0) + feedCost;
  const overBudget =
    wo.budget_ceiling_usd != null && spent > Number(wo.budget_ceiling_usd);

  return (
    <div
      ref={cardRef}
      className={`card${focused ? " wofocused" : ""}`}
      style={{ marginBottom: 14 }}
    >
      <div className="wohead">
        <span className="wt">{wo.title}</span>
        <code>{wo.wo_code ?? "—"}</code>
        {wo.risk_tier && (
          <span className={`tag ${tierTag(wo.risk_tier)}`}>{wo.risk_tier}</span>
        )}
        <span className={`badge ${terminal ? (wo.stage === "closed" ? "b-live" : "b-reg") : "b-ready"}`}>
          {wo.stage ?? wo.status}
        </span>
        {wo.source !== "manual" && (
          <span className="badge b-gov" title="Mirrored from the governed ledger — not editable here">
            {wo.source}
          </span>
        )}
        <span className="wm">
          {wo.agent ? <code>{wo.agent}</code> : "unassigned"} ·{" "}
          {productName ?? "company-wide"} · opened {when(wo.created_at)}
        </span>
      </div>

      {wo.objective && (
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>{wo.objective}</p>
      )}

      <StageTrack
        stage={wo.stage}
        blockedAt={
          wo.stage === "blocked"
            ? (events.find((e) => e.to_stage === "blocked")?.from_stage ?? null)
            : null
        }
      />

      <div className="kv">
        <div>
          <div className="k">Data classes</div>
          <div className="v">{wo.data_classes ?? "—"}</div>
        </div>
        <div>
          <div className="k">Audience · channel</div>
          <div className="v">
            {wo.audience ?? "—"} · {wo.channel ?? "—"}
          </div>
        </div>
        <div>
          <div className="k">Spend / ceiling</div>
          <div className="v" style={overBudget ? { color: "var(--danger)" } : undefined}>
            {usd(spent)} / {wo.budget_ceiling_usd == null ? "—" : usd(wo.budget_ceiling_usd)}
          </div>
        </div>
        <div>
          <div className="k">Remediation</div>
          <div className="v">
            {wo.remediation_rounds} of 3
            {wo.remediation_rounds >= 3 && " — human decision required"}
          </div>
        </div>
        <div>
          <div className="k">Approved</div>
          <div className="v">
            {wo.approved_at ? `${wo.approved_by} · ${when(wo.approved_at)}` : "not yet"}
          </div>
        </div>
        <div>
          <div className="k">Requested by</div>
          <div className="v">{wo.requester_email ?? "—"}</div>
        </div>
      </div>

      {def && !terminal && (
        <p className="flow">
          <b>{def.label}</b> — {ACTOR_LABEL[def.actor]}
          {def.gate ? ` · ${def.gate}` : ""}. Leaves when: {def.exit}
        </p>
      )}

      {canWrite && !terminal && wo.source === "manual" && (
        <div className="woactions">
          {wo.stage === "adjudicate" && !wo.approved_at && (
            <form action={appAction} className="woinline">
              <input type="hidden" name="id" value={wo.id} />
              <input
                name="note"
                maxLength={200}
                placeholder="Approval note (optional)"
              />
              <button type="submit" className="addbtn" disabled={appPending}>
                {appPending ? "Recording…" : "Approve"}
              </button>
            </form>
          )}

          {nexts.map((n) => (
            <form action={advAction} key={n} className="woinline">
              <input type="hidden" name="id" value={wo.id} />
              <input type="hidden" name="to_stage" value={n} />
              <input
                type="hidden"
                name="actor"
                value={STAGE_BY_ID.get(n)?.actor ?? "human"}
              />
              {n === "blocked" ? (
                <>
                  <input
                    name="detail"
                    required
                    maxLength={300}
                    placeholder="Why is this blocked?"
                  />
                  <button type="submit" className="addbtn2" disabled={advPending}>
                    Block
                  </button>
                </>
              ) : (
                <button type="submit" className="addbtn2" disabled={advPending}>
                  → {STAGE_BY_ID.get(n)?.label ?? n}
                </button>
              )}
            </form>
          ))}
        </div>
      )}

      {(advState.error || appState.error) && (
        <p className="err">{advState.error ?? appState.error}</p>
      )}

      <p style={{ marginTop: 10 }}>
        <button
          type="button"
          className="gtoggle"
          onClick={() => setOpenFeed((v) => !v)}
        >
          {openFeed ? "▾" : "▸"} Activity ({events.length})
        </button>
        {canWrite && wo.source === "manual" && (
          <button
            type="button"
            className="gtoggle"
            style={{ marginLeft: 14 }}
            onClick={() => setNoting((v) => !v)}
          >
            + record a gate result, verdict, or note
          </button>
        )}
      </p>

      {noting && canWrite && (
        <form action={evAction} className="formcard">
          <input type="hidden" name="id" value={wo.id} />
          <div className="field-row">
            <div className="field">
              <label htmlFor={`k-${wo.id}`}>Type</label>
              <select id={`k-${wo.id}`} name="kind" defaultValue="verdict">
                <option value="gate">Gate result</option>
                <option value="verdict">Evaluator verdict</option>
                <option value="escalation">Escalation</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`a-${wo.id}`}>Who</label>
              <input
                id={`a-${wo.id}`}
                name="actor_id"
                maxLength={60}
                placeholder="eval-factuality"
              />
            </div>
            <div className="field">
              <label htmlFor={`o-${wo.id}`}>Outcome</label>
              <input
                id={`o-${wo.id}`}
                name="outcome"
                maxLength={40}
                placeholder="pass / fail"
                list="wo-outcomes"
              />
              <datalist id="wo-outcomes">
                <option value="pass" />
                <option value="conditional_pass" />
                <option value="fail" />
                <option value="blocked" />
              </datalist>
            </div>
            <div className="field">
              <label htmlFor={`c-${wo.id}`}>Cost (USD)</label>
              <input
                id={`c-${wo.id}`}
                name="cost_usd"
                type="number"
                step="0.0001"
                min="0"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`d-${wo.id}`}>Detail</label>
            <textarea
              id={`d-${wo.id}`}
              name="detail"
              required
              rows={2}
              maxLength={1000}
              placeholder="A verdict is a defect list, not a score."
            />
          </div>
          <button type="submit" className="addbtn" disabled={evPending}>
            {evPending ? "Recording…" : "Record"}
          </button>
          <button
            type="button"
            className="addbtn2"
            onClick={() => setNoting(false)}
            disabled={evPending}
          >
            Cancel
          </button>
          {evState.error && <p className="err">{evState.error}</p>}
        </form>
      )}

      {openFeed && (
        <div className="wofeed">
          {events.length === 0 ? (
            <p className="note">Nothing recorded yet.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className={`woev ev-${e.kind}`}>
                <div className="woev-h">
                  <span className="woev-k">{e.kind}</span>
                  {e.outcome && (
                    <span
                      className={`tag ${
                        e.outcome === "fail" || e.outcome === "blocked"
                          ? "t-lo"
                          : e.outcome === "conditional_pass"
                            ? "t-med"
                            : "t-hi"
                      }`}
                    >
                      {e.outcome}
                    </span>
                  )}
                  {e.from_stage && e.to_stage && (
                    <span className="woev-s">
                      {e.from_stage} → {e.to_stage}
                    </span>
                  )}
                  <span className="woev-m">
                    {/* created_by_email is stamped by the database trigger and
                        cannot be supplied by the caller. actor_id is a claim
                        typed into a form, so it is shown as one. */}
                    {e.created_by_email ?? "system"}
                    {e.actor_id && e.actor_id !== e.created_by_email && (
                      <> · recorded for {e.actor_id}</>
                    )}
                    {" · "}
                    {when(e.created_at)}
                    {e.cost_usd != null && ` · ${usd(e.cost_usd)}`}
                  </span>
                </div>
                {e.detail && <div className="woev-d">{e.detail}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export { STAGES };
