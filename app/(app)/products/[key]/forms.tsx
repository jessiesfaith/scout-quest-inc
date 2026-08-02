"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addArea,
  setAreaStatus,
  deleteArea,
  addPlanItem,
  deletePlanItem,
  addWebsite,
  deleteWebsite,
  logProductChange,
  type ActionState,
} from "./actions";

const init: ActionState = { error: null };

// Shared: reset the form once a submit comes back clean.
function useResetOnSuccess(pending: boolean, state: ActionState) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state]);
  return { formRef, mark: () => (submitted.current = true) };
}

function Err({ state }: { state: ActionState }) {
  return state.error ? <p className="err">{state.error}</p> : null;
}

function DeleteBtn({
  action,
  name,
  id,
  productKey,
}: {
  action: typeof deleteArea;
  name: string;
  id: string;
  productKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name={name} value={id} />
      <input type="hidden" name="product_key" value={productKey} />
      <button type="submit" className="minibtn del" disabled={pending}>
        {pending ? "…" : "Remove"}
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

// ---------- Build Board ----------

export function AddAreaForm({ productKey }: { productKey: string }) {
  const [state, formAction, pending] = useActionState(addArea, init);
  const { formRef, mark } = useResetOnSuccess(pending, state);

  return (
    <form
      ref={formRef}
      className="formcard"
      action={(fd) => {
        mark();
        formAction(fd);
      }}
    >
      <input type="hidden" name="product_key" value={productKey} />
      <div className="field-row">
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="area">Area *</label>
          <input id="area" name="area" required placeholder="Student app" />
        </div>
        <div className="field">
          <label htmlFor="area-status">Status</label>
          <select id="area-status" name="status" defaultValue="planned">
            <option value="planned">planned</option>
            <option value="building">building</option>
            <option value="live">live</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="note">Note</label>
          <input id="note" name="note" placeholder="optional" />
        </div>
      </div>
      <Err state={state} />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Adding…" : "Add area"}
      </button>
    </form>
  );
}

export function AreaStatus({
  areaId,
  status,
  productKey,
}: {
  areaId: string;
  status: string;
  productKey: string;
}) {
  const [state, formAction, pending] = useActionState(setAreaStatus, init);
  const next =
    status === "planned" ? "building" : status === "building" ? "live" : "planned";
  const cls =
    status === "live" ? "b-live" : status === "building" ? "b-ready" : "b-plan";

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="area_id" value={areaId} />
      <input type="hidden" name="product_key" value={productKey} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        title={`Move to ${next}`}
        className={`badge ${cls}`}
        style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        {pending ? "…" : status}
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

export function DeleteArea(props: { id: string; productKey: string }) {
  return (
    <DeleteBtn
      action={deleteArea}
      name="area_id"
      id={props.id}
      productKey={props.productKey}
    />
  );
}

// ---------- Plan Board ----------

export function AddPlanForm({
  productKey,
  parents,
}: {
  productKey: string;
  parents: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPlanItem, init);
  const { formRef, mark } = useResetOnSuccess(pending, state);

  return (
    <form
      ref={formRef}
      className="formcard"
      action={(fd) => {
        mark();
        formAction(fd);
      }}
    >
      <input type="hidden" name="product_key" value={productKey} />
      <div className="field-row">
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="title">Item *</label>
          <input id="title" name="title" required placeholder="Parent control panel" />
        </div>
        <div className="field">
          <label htmlFor="parent_id">Task under</label>
          <select id="parent_id" name="parent_id" defaultValue="">
            <option value="">— top level —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="start_date">Start</label>
          <input id="start_date" name="start_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="end_date">End</label>
          <input id="end_date" name="end_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="plan-status">Status</label>
          <select id="plan-status" name="status" defaultValue="planned">
            <option value="planned">planned</option>
            <option value="building">building</option>
            <option value="live">live</option>
          </select>
        </div>
      </div>
      <Err state={state} />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Adding…" : "Add plan item"}
      </button>
    </form>
  );
}

// Deleting a parent cascades to its tasks, so name the blast radius before
// doing it — same two-step used for roles and contracts.
export function DeletePlanItem({
  id,
  productKey,
  childCount = 0,
}: {
  id: string;
  productKey: string;
  childCount?: number;
}) {
  const [state, formAction, pending] = useActionState(deletePlanItem, init);
  const [confirming, setConfirming] = useState(false);

  if (childCount === 0) {
    return (
      <DeleteBtn
        action={deletePlanItem}
        name="item_id"
        id={id}
        productKey={productKey}
      />
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="minibtn del"
        onClick={() => setConfirming(true)}
      >
        Remove (+{childCount} task{childCount === 1 ? "" : "s"})
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="item_id" value={id} />
      <input type="hidden" name="product_key" value={productKey} />
      <button type="submit" className="minibtn del" disabled={pending}>
        {pending
          ? "…"
          : `Confirm — also deletes ${childCount} task${childCount === 1 ? "" : "s"}`}
      </button>
      <button
        type="button"
        className="minibtn"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

// ---------- Websites ----------

export function AddWebsiteForm({ productKey }: { productKey: string }) {
  const [state, formAction, pending] = useActionState(addWebsite, init);
  const { formRef, mark } = useResetOnSuccess(pending, state);

  return (
    <form
      ref={formRef}
      className="addmember"
      action={(fd) => {
        mark();
        formAction(fd);
      }}
    >
      <input type="hidden" name="product_key" value={productKey} />
      <input name="label" required placeholder="Label (e.g. Admin Console)" aria-label="Label" />
      <input name="url" required placeholder="https://..." aria-label="URL" />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Adding…" : "Add link"}
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

export function DeleteWebsite(props: { id: string; productKey: string }) {
  return (
    <DeleteBtn
      action={deleteWebsite}
      name="website_id"
      id={props.id}
      productKey={props.productKey}
    />
  );
}

// ---------- Change log ----------

export function LogProductChangeForm({ productKey }: { productKey: string }) {
  const [state, formAction, pending] = useActionState(logProductChange, init);
  const { formRef, mark } = useResetOnSuccess(pending, state);

  return (
    <form
      ref={formRef}
      className="formcard"
      action={(fd) => {
        mark();
        formAction(fd);
      }}
    >
      <input type="hidden" name="product_key" value={productKey} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="cl-tab">Tab</label>
          <input id="cl-tab" name="tab" placeholder="Build Board" />
        </div>
        <div className="field">
          <label htmlFor="cl-type">Type</label>
          <select id="cl-type" name="change_type" defaultValue="update">
            <option value="new">new</option>
            <option value="update">update</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="cl-desc">What changed *</label>
        <textarea id="cl-desc" name="description" rows={2} required />
      </div>
      <Err state={state} />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Recording…" : "Record entry"}
      </button>
      <span className="note" style={{ marginLeft: 10, fontSize: 12 }}>
        Entries are permanent — the log cannot be edited or deleted.
      </span>
    </form>
  );
}
