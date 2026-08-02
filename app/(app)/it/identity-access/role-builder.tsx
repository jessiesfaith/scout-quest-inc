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
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
        <input
          type="checkbox"
          name="grant_all"
          checked={grantAll}
          onChange={(e) => setGrantAll(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Grant all (full access — writes {`["ALL"]`})
      </label>

      <p className="text-xs text-muted">
        Keys for modules that haven&apos;t shipped yet (Finance, Contracts,
        Projects, and some Products tabs) are saved on the role now and start
        working when their module goes live. Contract records specifically are
        unlocked by <b>HR: HR Contracts</b>.
      </p>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${grantAll ? "pointer-events-none opacity-40" : ""}`}
      >
        {PERMISSION_GROUPS.map((group) => (
          <fieldset
            key={group.module}
            className="rounded-xl border border-border p-3"
          >
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted">
              {group.module}
            </legend>
            <div className="space-y-1.5">
              {group.keys.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="perm"
                    value={key}
                    defaultChecked={defaults.includes(key)}
                    disabled={grantAll}
                    className="accent-[var(--accent)]"
                  />
                  {key.includes(": ") ? key.split(": ")[1] : key}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function RoleForm({
  role,
  onDone,
}: {
  role: Role | null;
  onDone: () => void;
}) {
  const action = role ? updateRole : createRole;
  const [state, formAction, pending] = useActionState(action, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !pending && !state.error) onDone();
    if (!pending) submittedRef.current = false;
  }, [pending, state, onDone]);

  return (
    <form
      action={(fd) => {
        submittedRef.current = true;
        formAction(fd);
      }}
      className="space-y-4 rounded-2xl border border-accent/40 bg-surface p-5"
    >
      {role && <input type="hidden" name="role_id" value={role.id} />}
      <div>
        <label htmlFor="role-name" className="mb-1.5 block text-sm text-muted">
          Role name
        </label>
        <input
          id="role-name"
          name="name"
          required
          defaultValue={role?.name ?? ""}
          placeholder="e.g. Product Editor"
          className="w-72 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
        />
      </div>

      <PermissionTree
        defaults={role?.permissions ?? []}
        grantAllDefault={role?.permissions.includes(ALL_KEY) ?? false}
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : role ? "Save role" : "Create role"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
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
        onClick={() => setConfirming(true)}
        className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="role_id" value={roleId} />
      <span className="text-xs text-danger">
        Removes the role from everyone holding it.
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-muted hover:text-foreground"
      >
        Keep
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function RolesPanel({ roles }: { roles: Role[] }) {
  // null = closed; "new" = creating; otherwise the role id being edited
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {roles.map((role) =>
        editing === role.id ? (
          <RoleForm key={role.id} role={role} onDone={() => setEditing(null)} />
        ) : (
          <div
            key={role.id}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{role.name}</span>
                {role.permissions.includes(ALL_KEY) ? (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                    ALL — full access
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(role.id)}
                  className="text-xs text-accent underline-offset-2 hover:underline"
                >
                  Edit
                </button>
                <DeleteRoleButton roleId={role.id} />
              </div>
            </div>
            {!role.permissions.includes(ALL_KEY) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        ),
      )}

      {roles.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted">
          No roles yet — create the first one.
        </p>
      )}

      {editing === "new" ? (
        <RoleForm role={null} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
        >
          New role
        </button>
      )}
    </div>
  );
}
