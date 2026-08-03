"use client";

import { useActionState, useRef, useState } from "react";
import {
  saveMissionValues,
  type ActionState,
  type ValueItem,
} from "./actions";

const initialState: ActionState = { error: null, saved: false };

type KeyedValue = ValueItem & { key: string };

export function MissionValuesForm({
  purpose,
  mission,
  values,
  scope = "company",
}: {
  purpose: string;
  mission: string;
  values: ValueItem[];
  /** "company", or a product key for the product-scoped copy. */
  scope?: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveMissionValues,
    initialState,
  );
  // Controlled rows with stable keys: with uncontrolled inputs, removing a
  // row leaves React reusing the previous DOM nodes, so the wrong text
  // stays on screen and gets saved.
  const [rows, setRows] = useState<KeyedValue[]>(() =>
    (values.length > 0 ? values : [{ title: "", body: "" }]).map((v, i) => ({
      ...v,
      key: `v${i}`,
    })),
  );
  const nextKey = useRef(rows.length);

  function updateRow(key: string, patch: Partial<ValueItem>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="scope" value={scope} />
      <h2 className="sec">Purpose</h2>
      <div className="formcard">
        <div className="field">
          <label htmlFor="purpose">Why the company exists, in one line</label>
          <input id="purpose" name="purpose" defaultValue={purpose} />
        </div>
      </div>

      <h2 className="sec">Mission</h2>
      <div className="formcard">
        <div className="field">
          <label htmlFor="mission">What we are building and for whom</label>
          <textarea id="mission" name="mission" rows={3} defaultValue={mission} />
        </div>
      </div>

      <h2 className="sec">Values</h2>
      <div className="formcard">
        {rows.map((row) => (
          <div className="field-row" key={row.key}>
            <div className="field">
              <label>Value</label>
              <input
                name="value_title"
                value={row.title}
                onChange={(e) => updateRow(row.key, { title: e.target.value })}
                placeholder="Safety first"
              />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>What it means in practice</label>
              <input
                name="value_body"
                value={row.body}
                onChange={(e) => updateRow(row.key, { body: e.target.value })}
              />
            </div>
            <div style={{ alignSelf: "end" }}>
              <button
                type="button"
                className="minibtn del"
                onClick={() =>
                  setRows((prev) => prev.filter((r) => r.key !== row.key))
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="minibtn"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { title: "", body: "", key: `n${nextKey.current++}` },
            ])
          }
        >
          Add value
        </button>
        <p className="note" style={{ fontSize: 12 }}>
          Empty rows are dropped when you save.
        </p>
      </div>

      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && (
        <span className="err" style={{ marginLeft: 10 }}>
          {state.error}
        </span>
      )}
      {state.saved && !state.error && (
        <span className="ok" style={{ marginLeft: 10 }}>
          Saved.
        </span>
      )}
    </form>
  );
}
