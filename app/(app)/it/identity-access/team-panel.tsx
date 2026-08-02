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

function UnassignChip({ id, label }: { id: string; label: string }) {
  const [state, formAction, pending] = useActionState(
    unassignRole,
    initialState,
  );

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="assignment_id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="tag t-hi"
        title="Remove this role"
        style={{
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          marginRight: 5,
        }}
      >
        {label} ×
      </button>
      {state.error && (
        <span className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}

function AssignForm({
  memberId,
  available,
}: {
  memberId: string;
  available: Role[];
}) {
  const [state, formAction, pending] = useActionState(assignRole, initialState);
  if (available.length === 0) return null;

  return (
    <form action={formAction} className="addmember" style={{ margin: "8px 0 0" }}>
      <input type="hidden" name="team_member_id" value={memberId} />
      <select name="role_id" defaultValue="" required aria-label="Role">
        <option value="" disabled>
          — role —
        </option>
        {available.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button type="submit" className="minibtn" disabled={pending}>
        {pending ? "…" : "Assign"}
      </button>
      {state.error && (
        <span className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}

function LinkAccountForm({
  memberId,
  current,
  profiles,
}: {
  memberId: string;
  current: string | null;
  profiles: ProfileOption[];
}) {
  const [state, formAction, pending] = useActionState(linkAccount, initialState);

  return (
    <form action={formAction} className="addmember" style={{ margin: 0 }}>
      <input type="hidden" name="team_member_id" value={memberId} />
      <select
        name="profile_id"
        defaultValue={current ?? ""}
        aria-label="Linked account"
      >
        <option value="">— no linked account —</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.email}
          </option>
        ))}
      </select>
      <button type="submit" className="minibtn" disabled={pending}>
        {pending ? "…" : "Save"}
      </button>
      {state.error && (
        <span className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
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
      <p className="note">
        No team members yet — add them under HR › Team, then assign roles
        here.
      </p>
    );
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Team member</th>
            <th>Linked account</th>
            <th>Roles</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const held = new Set(m.assignments.map((a) => a.role_id));
            return (
              <tr key={m.id}>
                <td style={{ verticalAlign: "top" }}>
                  <b>{m.name}</b>
                  {m.working_on && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {m.working_on}
                    </div>
                  )}
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <LinkAccountForm
                    memberId={m.id}
                    current={m.profile_id}
                    profiles={profiles}
                  />
                  {!m.profile_id && (
                    <div style={{ fontSize: 11.5, color: "var(--warn)" }}>
                      Roles only take effect once an account is linked.
                    </div>
                  )}
                </td>
                <td style={{ verticalAlign: "top" }}>
                  {m.assignments.length === 0 ? (
                    <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                      No roles
                    </span>
                  ) : (
                    m.assignments.map((a) => (
                      <UnassignChip
                        key={a.id}
                        id={a.id}
                        label={roleName.get(a.role_id) ?? "?"}
                      />
                    ))
                  )}
                  <AssignForm
                    memberId={m.id}
                    available={roles.filter((r) => !held.has(r.id))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
