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
}: {
  purpose: string;
  mission: string;
  values: ValueItem[];
}) {
  const [state, formAction, pending] = useActionState(
    saveMissionValues,
    initialState,
  );
  // Controlled rows with stable keys: with uncontrolled inputs, removing a
  // row leaves React reusing the previous DOM nodes, so the wrong text
  // stays on screen and gets saved.
  const [rows, setRows] = useState<KeyedValue[]>(() =>
    (values.length > 0 ? values : [{ title: "", body: "" }]).map(
      (v, i) => ({ ...v, key: `v${i}` }),
    ),
  );
  const nextKey = useRef(rows.length);

  function updateRow(key: string, patch: Partial<ValueItem>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <label htmlFor="purpose" className="mb-1.5 block text-sm text-muted">
          Purpose
        </label>
        <input
          id="purpose"
          name="purpose"
          defaultValue={purpose}
          placeholder="Why the company exists, in one line"
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
        />

        <label
          htmlFor="mission"
          className="mb-1.5 mt-4 block text-sm text-muted"
        >
          Mission
        </label>
        <textarea
          id="mission"
          name="mission"
          rows={3}
          defaultValue={mission}
          placeholder="What we are building and for whom"
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Values</h2>
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
            >
              <input
                name="value_title"
                value={row.title}
                onChange={(e) => updateRow(row.key, { title: e.target.value })}
                placeholder="Safety first"
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
              />
              <input
                name="value_body"
                value={row.body}
                onChange={(e) => updateRow(row.key, { body: e.target.value })}
                placeholder="What it means in practice"
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
              />
              <button
                type="button"
                onClick={() =>
                  setRows((prev) => prev.filter((r) => r.key !== row.key))
                }
                className="justify-self-start px-2 text-xs text-muted hover:text-danger sm:justify-self-center"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { title: "", body: "", key: `n${nextKey.current++}` },
            ])
          }
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition hover:border-accent"
        >
          Add value
        </button>
        <p className="mt-2 text-xs text-muted">
          Empty rows are dropped when you save.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
        {state.saved && !state.error && (
          <span className="text-sm text-success">Saved.</span>
        )}
      </div>
    </form>
  );
}
