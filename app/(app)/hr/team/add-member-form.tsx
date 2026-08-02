"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTeamMember, type AddMemberState } from "./actions";

const initialState: AddMemberState = { error: null, success: false };

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState(
    addTeamMember,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-semibold">Add member</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs text-muted">
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Ada Lovelace"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="role" className="mb-1.5 block text-xs text-muted">
            Role
          </label>
          <input
            id="role"
            name="role"
            placeholder="Game designer"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="ada@example.com"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </div>
      </div>

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}
