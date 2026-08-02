"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PERMISSION_GROUPS, ALL_KEY } from "@/lib/permission-keys";
import {
  createRole,
  updateRole,
  deleteRole,
  type ActionState,
} from "./actions";

const initialState: ActionState = { error: null };

export type Role = {
  id: string;
  name: string;
  permissions: string[];
};

function PermissionTree({
  defaults,
  grantAllDefault,
}: {
  defaults: string[];
  grantAllDefault: boolean;
}) {
  const [grantAll, setGrantAll] = useState(grantAllDefault);

  return (
    <div id="perm-tree">
      <label
        className="permmod"
        style={{
          display: "block",
          background: "var(--a-soft)",
          borderColor: "var(--a)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="grant_all"
          checked={grantAll}
          onChange={(e) => setGrantAll(e.target.checked)}
        />{" "}
        <b style={{ color: "var(--a)" }}>Grant all</b>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {" "}
          — full access to every module
        </span>
      </label>

      <div style={grantAll ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
        {PERMISSION_GROUPS.map((group) => (
          <div className="permmod" key={group.module}>
            <b style={{ fontSize: 13 }}>{group.module}</b>
            <div className="pm-items">
              {group.keys.map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name="perm"
                    value={key}
                    defaultChecked={defaults.includes(key)}
                    disabled={grantAll}
                  />
                  {key.includes(": ") ? key.split(": ")[1] : key}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="note" style={{ fontSize: 12, color: "var(--muted)" }}>
        Keys for modules that have not shipped yet are saved now and start
        working when the module goes live. Contract records specifically are
        unlocked by <b>HR Contracts</b>.
      </p>
    </div>
  );
}

function RoleForm({ role, onDone }: { role: Role | null; onDone: () => void }) {
  const action = role ? updateRole : createRole;
  const [state, formAction, pending] = useActionState(action, initialState);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) onDone();
    if (!pending) submitted.current = false;
  }, [pending, state, onDone]);

  return (
    <form
      className="rolebuilder"
      action={(fd) => {
        submitted.current = true;
        formAction(fd);
      }}
    >
      {role && <input type="hidden" name="role_id" value={role.id} />}
      <input
        name="name"
        required
        defaultValue={role?.name ?? ""}
        placeholder="Role name (e.g. Content Lead)"
      />
      <PermissionTree
        defaults={role?.permissions ?? []}
        grantAllDefault={role?.permissions.includes(ALL_KEY) ?? false}
      />
      <div style={{ marginTop: 12 }}>
        <button type="submit" className="addbtn" disabled={pending}>
          {pending ? "Saving…" : role ? "Save role" : "Save role"}
        </button>
        <button type="button" className="addbtn2" onClick={onDone}>
          Cancel
        </button>
        {state.error && (
          <span
            className="note"
            style={{ color: "var(--danger)", marginLeft: 10 }}
          >
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

function DeleteRoleButton({ roleId }: { roleId: string }) {
  const [state, formAction, pending] = useActionState(deleteRole, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="minibtn del"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="role_id" value={roleId} />
      <button type="submit" className="minibtn del" disabled={pending}>
        {pending ? "Deleting…" : "Confirm — removes it from everyone"}
      </button>
      <button
        type="button"
        className="minibtn"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
      {state.error && (
        <span className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}

export function RolesPanel({ roles }: { roles: Role[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      {editing === "new" ? (
        <RoleForm role={null} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          className="addbtn"
          style={{ marginBottom: 14 }}
          onClick={() => setEditing("new")}
        >
          Create a role
        </button>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Access (modules · tabs)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  No roles yet — create the first one.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <b>{role.name}</b>
                  </td>
                  <td>
                    {role.permissions.includes(ALL_KEY) ? (
                      <span className="badge b-gov">ALL — full access</span>
                    ) : role.permissions.length === 0 ? (
                      <span style={{ color: "var(--warn)" }}>
                        No permissions — grants entry but nothing else
                      </span>
                    ) : (
                      role.permissions.map((p) => (
                        <span
                          key={p}
                          className="tag t-hi"
                          style={{ marginRight: 5, display: "inline-block" }}
                        >
                          {p}
                        </span>
                      ))
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="minibtn"
                      onClick={() => setEditing(role.id)}
                    >
                      Edit
                    </button>
                    <DeleteRoleButton roleId={role.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && editing !== "new" && (
        <div style={{ marginTop: 14 }}>
          <RoleForm
            role={roles.find((r) => r.id === editing) ?? null}
            onDone={() => setEditing(null)}
          />
        </div>
      )}
    </>
  );
}
