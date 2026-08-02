"use client";

import { useActionState } from "react";
import type { Role } from "./role-builder";
import {
  assignRole,
  unassignRole,
  linkAccount,
  type ActionState,
} from "./actions";

const initialState: ActionState = { error: null };

export type Member = {
  id: string;
  name: string;
  working_on: string | null;
  profile_id: string | null;
  assignments: { id: string; role_id: string }[];
};

export type ProfileOption = {
  id: string;
  email: string;
  full_name: string | null;
};

function UnassignChip({
  assignmentId,
  label,
}: {
  assignmentId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    unassignRole,
    initialState,
  );

  return (
    <form action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        title="Remove this role"
        className="group inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent transition hover:bg-danger/15 hover:text-danger disabled:opacity-50"
      >
        {label}
        <span aria-hidden="true" className="font-bold">
          ×
        </span>
      </button>
      {state.error && (
        <span className="mt-1 text-xs text-danger">{state.error}</span>
      )}
    </form>
  );
}

function AssignForm({
  memberId,
  availableRoles,
}: {
  memberId: string;
  availableRoles: Role[];
}) {
  const [state, formAction, pending] = useActionState(assignRole, initialState);

  if (availableRoles.length === 0) return null;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="team_member_id" value={memberId} />
      <select
        name="role_id"
        defaultValue=""
        required
        className="rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs outline-none focus:border-accent"
      >
        <option value="" disabled>
          Add role…
        </option>
        {availableRoles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground transition hover:border-accent disabled:opacity-50"
      >
        {pending ? "…" : "Assign"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function LinkAccountForm({
  memberId,
  currentProfileId,
  profiles,
}: {
  memberId: string;
  currentProfileId: string | null;
  profiles: ProfileOption[];
}) {
  const [state, formAction, pending] = useActionState(linkAccount, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="team_member_id" value={memberId} />
      <select
        name="profile_id"
        defaultValue={currentProfileId ?? ""}
        className="max-w-56 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs outline-none focus:border-accent"
      >
        <option value="">No linked account</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.email}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground transition hover:border-accent disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function TeamPanel({
  members,
  roles,
  profiles,
}: {
  members: Member[];
  roles: Role[];
  profiles: ProfileOption[];
}) {
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted">
        No team members yet — add them under HR › Team, then assign roles here.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
            <th className="px-5 py-3 font-medium">Member</th>
            <th className="px-5 py-3 font-medium">Linked account</th>
            <th className="px-5 py-3 font-medium">Roles</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const held = new Set(m.assignments.map((a) => a.role_id));
            const available = roles.filter((r) => !held.has(r.id));
            return (
              <tr key={m.id} className="border-b border-border last:border-b-0 align-top">
                <td className="px-5 py-3">
                  <div className="font-medium">{m.name}</div>
                  {m.working_on && (
                    <div className="text-xs text-muted">{m.working_on}</div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <LinkAccountForm
                    memberId={m.id}
                    currentProfileId={m.profile_id}
                    profiles={profiles}
                  />
                  {!m.profile_id && (
                    <p className="mt-1 text-xs text-muted">
                      Roles only take effect once an account is linked.
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.assignments.map((a) => (
                      <UnassignChip
                        key={a.id}
                        assignmentId={a.id}
                        label={roleName.get(a.role_id) ?? "?"}
                      />
                    ))}
                    {m.assignments.length === 0 && (
                      <span className="text-xs text-muted">No roles</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <AssignForm memberId={m.id} availableRoles={available} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
