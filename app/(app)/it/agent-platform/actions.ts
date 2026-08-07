"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { RISK_TIERS, type Stage } from "@/lib/agent-library";

// One key for the whole module — the same string 0003/0015/0018 use in RLS.
const KEY = "IT: Agent Platform";
const PAGE = "/it/agent-platform";

export type WoState = { error: string | null; success: boolean };

// The app-layer check is for the friendly message only. The real gate is
// inside the SQL: has_perm() in advance_work_order/approve_work_order, and
// RLS on the tables. HANDOFF §5.3 — a check in a server action is not
// enforcement, because PostgREST exposes every function granted to
// `authenticated` and the attacker simply does not call this file.
async function guard() {
  const ok = await checkPerm(KEY);
  return ok ? null : `Not saved — the ${KEY} permission covers this screen.`;
}

// ---------------------------------------------------------------------
// Open a work order
// ---------------------------------------------------------------------

export async function openWorkOrder(
  _prev: WoState,
  formData: FormData,
): Promise<WoState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const agent = String(formData.get("agent") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const riskTier = String(formData.get("risk_tier") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const dataClasses = String(formData.get("data_classes") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const budgetRaw = String(formData.get("budget_ceiling_usd") ?? "").trim();

  // GATE-intake, in the only place it currently exists. Every one of these
  // is a required field on the work order, and the rule is that a missing
  // field is returned for correction rather than inferred — a work order
  // with no risk tier is not a low-risk work order.
  if (!agent) return { error: "Assign an agent. Intake does not guess one.", success: false };
  if (!title) return { error: "A work order needs a title.", success: false };
  if (!objective)
    return { error: "State the objective. 'What are we trying to achieve' is a required intake field.", success: false };
  if (!(RISK_TIERS as readonly string[]).includes(riskTier))
    return {
      error: `Risk tier must be one of: ${RISK_TIERS.join(", ")}. Intake assigns it before any agent runs; it can be raised later but never lowered.`,
      success: false,
    };
  if (!dataClasses)
    return { error: "Declare the data classes this work order touches.", success: false };

  // D3 cannot be declared here at all. The Company OS is D0–D2 by design
  // (HANDOFF §1), and an agent that needs D3 runs on the governed plane.
  // This is the friendly message only — migration 0018's work_orders_no_d3
  // CHECK constraint is what actually enforces it, because PostgREST is the
  // surface an attacker uses and it never runs this file (HANDOFF §5.3).
  if (/d3/i.test(dataClasses))
    return {
      error:
        "D3 cannot enter this app. Regulated data stays on the governed plane — open this work order there instead. (Constitution §5.1)",
      success: false,
    };

  const budget = budgetRaw === "" ? null : Number(budgetRaw);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0))
    return { error: "Budget ceiling must be a number, or left blank.", success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check the agent's risk ceiling before opening, so the work order cannot
  // be created in a state GATE-authz would refuse later. This is a courtesy
  // — the authoritative check belongs in the gate, which is not built.
  const { data: agentRow } = await supabase
    .from("agents")
    .select("agent_id, risk_ceiling, lifecycle, enabled, blocked_reason")
    .eq("agent_id", agent)
    .maybeSingle();

  if (!agentRow)
    return { error: `No agent registered as "${agent}".`, success: false };

  const order = ["low", "medium", "high", "critical"];
  if (
    agentRow.risk_ceiling &&
    order.indexOf(riskTier) > order.indexOf(agentRow.risk_ceiling)
  )
    return {
      error: `${agent} has a ${agentRow.risk_ceiling} risk ceiling and cannot be assigned ${riskTier}-tier work. Raise the ceiling in its spec (a Class 2–3 change), or assign a different agent.`,
      success: false,
    };

  if (agentRow.enabled === false)
    return {
      error: `${agent} is not enabled${agentRow.blocked_reason ? ` — ${agentRow.blocked_reason}` : ""}. You can still open the work order against it once it is active.`,
      success: false,
    };

  // wo_code: WO-<PRODUCT>-<NNNN>, the canonical form from Constitution §2.
  // Sequence per product so the codes stay short and meaningful.
  const { data: productRow } = productId
    ? await supabase.from("products").select("key").eq("id", productId).maybeSingle()
    : { data: null };
  const scope = (productRow?.key ?? "OPS").toUpperCase().slice(0, 12);

  // Highest existing number, not a row count: a count collides with a live
  // code as soon as anything is deleted, and it also counts ledger-ingested
  // rows whose codes this sequence does not control. Uniqueness is the
  // database's job — 0018 puts a unique index on wo_code — so this loop
  // retries on the one error that means "someone else took it", which is the
  // only safe way to do this without a real sequence.
  let woCode = "";
  let data: { id: string } | null = null;
  let error: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await supabase
      .from("work_orders")
      .select("wo_code")
      .like("wo_code", `WO-${scope}-%`)
      .order("wo_code", { ascending: false })
      .limit(1)
      .maybeSingle();

    const highest = Number(last?.wo_code?.split("-").pop() ?? 0);
    const next = (Number.isFinite(highest) ? highest : 0) + 1 + attempt;
    woCode = `WO-${scope}-${String(next).padStart(4, "0")}`;

    const res = await supabase
      .from("work_orders")
      .insert({
      wo_code: woCode,
      agent,
      title,
      description: objective,
      objective,
      status: "open",
      stage: "intake",
      risk_tier: riskTier,
      audience: audience || null,
      channel: channel || null,
      data_classes: dataClasses,
      product_id: productId || null,
      budget_ceiling_usd: budget,
      requester_email: user?.email ?? null,
      source: "manual",
      })
      .select("id")
      .maybeSingle();

    data = res.data;
    error = res.error;
    // 23505 = unique_violation. Anything else is a real failure.
    if (!error || error.code !== "23505") break;
  }

  if (error) return { error: error.message, success: false };
  if (!data)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  // The opening entry on the append-only feed. Written through the same
  // table everything else uses, so the first line of a work order's history
  // is as unforgeable as the last.
  const { error: evErr } = await supabase.from("work_order_events").insert({
    work_order_id: data.id,
    kind: "stage",
    to_stage: "intake",
    actor: "human",
    actor_id: user?.email ?? null,
    outcome: "opened",
    detail: `Opened at ${riskTier} tier against ${agent}.`,
  });

  revalidatePath(PAGE);
  // The work order exists either way — reporting failure would be worse than
  // reporting a partial success, since a retry would open a second one. But
  // a work order with no first line of history is a gap in the evidence, and
  // saying so is the only honest option.
  if (evErr)
    return {
      error: `${woCode} was opened, but its first activity entry did not save (${evErr.message}). The history for this work order starts incomplete.`,
      success: true,
    };

  return { error: null, success: true };
}

// ---------------------------------------------------------------------
// Advance a work order
// ---------------------------------------------------------------------

export async function advanceWorkOrder(
  _prev: WoState,
  formData: FormData,
): Promise<WoState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  const to = String(formData.get("to_stage") ?? "").trim() as Stage;
  const actor = String(formData.get("actor") ?? "human").trim();
  const actorId = String(formData.get("actor_id") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();

  if (!id || !to) return { error: "Missing work order or stage.", success: false };

  // A block must say why. A terminal state with no reason is an unreadable
  // audit trail six months later.
  if (to === "blocked" && !detail)
    return {
      error: "Blocking a work order needs a reason — it is a terminal state and the feed cannot be edited afterwards.",
      success: false,
    };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_work_order", {
    p_work_order: id,
    p_to_stage: to,
    p_actor: actor || "human",
    p_actor_id: actorId || null,
    p_outcome: outcome || null,
    p_detail: detail || null,
  });

  // The database raises on an illegal transition, a fourth remediation
  // round, or a release without a recorded approval. Surface its message
  // rather than a generic one — the message IS the governance explanation.
  if (error) return { error: error.message, success: false };
  if (!data) return { error: "The transition was refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

// ---------------------------------------------------------------------
// Record a gate result, a verdict, or a note
// ---------------------------------------------------------------------

export async function recordEvent(
  _prev: WoState,
  formData: FormData,
): Promise<WoState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const actor = String(formData.get("actor") ?? "").trim();
  const actorId = String(formData.get("actor_id") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const costRaw = String(formData.get("cost_usd") ?? "").trim();

  if (!id) return { error: "Missing work order.", success: false };
  if (!["gate", "verdict", "escalation", "note"].includes(kind))
    return { error: "Unknown entry type.", success: false };
  if (!detail)
    return { error: "An entry needs a detail — the feed is the evidence.", success: false };

  const cost = costRaw === "" ? null : Number(costRaw);
  if (cost !== null && (!Number.isFinite(cost) || cost < 0))
    return { error: "Cost must be a number, or left blank.", success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_order_events")
    .insert({
      work_order_id: id,
      kind,
      actor: actor || "human",
      actor_id: actorId || null,
      outcome: outcome || null,
      detail,
      cost_usd: cost,
    })
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

// ---------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------

export async function approveWorkOrder(
  _prev: WoState,
  formData: FormData,
): Promise<WoState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return { error: "Missing work order.", success: false };

  const supabase = await createClient();
  // approve_work_order() gates on aal2 INSIDE the function body and takes the
  // approver from auth.uid(), never from an argument. Both matter: a
  // security definer function that accepts a user id can be aimed at anyone.
  const { error } = await supabase.rpc("approve_work_order", {
    p_work_order: id,
    p_note: note || null,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}
