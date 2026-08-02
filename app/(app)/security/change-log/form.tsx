"use client";

import { useActionState, useEffect, useRef } from "react";
import { logChange, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function LogChangeForm({ defaultClass }: { defaultClass?: string }) {
  const [state, formAction, pending] = useActionState(logChange, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        submitted.current = true;
        formAction(fd);
      }}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-semibold">Log a change</h2>
      <p className="mt-1 text-xs text-muted">
        Entries are permanent — the log cannot be edited or deleted by anyone,
        including the owner.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="product" className="mb-1.5 block text-xs text-muted">
            Product
          </label>
          <input
            id="product"
            name="product"
            defaultValue="company"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="module" className="mb-1.5 block text-xs text-muted">
            Module
          </label>
          <input
            id="module"
            name="module"
            placeholder="HR"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="tab" className="mb-1.5 block text-xs text-muted">
            Tab
          </label>
          <input
            id="tab"
            name="tab"
            placeholder="Contracts"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </div>
        <div>
          <label
            htmlFor="change_type"
            className="mb-1.5 block text-xs text-muted"
          >
            Type
          </label>
          <select
            id="change_type"
            name="change_type"
            defaultValue="update"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="new">new</option>
            <option value="update">update</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="change_class"
            className="mb-1.5 block text-xs text-muted"
          >
            Class
          </label>
          <select
            id="change_class"
            name="change_class"
            defaultValue={defaultClass ?? ""}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">—</option>
            <option value="1">1 — routine</option>
            <option value="2">2 — notable</option>
            <option value="3">3 — governed</option>
            <option value="3+">3+ — high risk</option>
          </select>
        </div>
      </div>

      <label
        htmlFor="description"
        className="mb-1.5 mt-3 block text-xs text-muted"
      >
        What changed *
      </label>
      <textarea
        id="description"
        name="description"
        required
        rows={2}
        placeholder="Added HR Contracts with private file storage"
        className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
      />

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record entry"}
      </button>
    </form>
  );
}
