"use client";

import { useActionState } from "react";
import { createRole, assignRole, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function CreateRoleForm() {
  const [state, formAction, pending] = useActionState(createRole, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        required
        placeholder="New role name (e.g. Designer)"
        className="w-56 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create role"}
      </button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}

export function AssignRoleForm({
  profileId,
  currentRoleId,
  roles,
}: {
  profileId: string;
  currentRoleId: string | null;
  roles: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignRole, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <select
        name="role_id"
        defaultValue={currentRoleId ?? ""}
        className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="">No role (no access)</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}
