"use client";

import { useActionState, useState } from "react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentState,
} from "./actions";
import { useCloseOnSuccess } from "../use-close-on-success";

const initialState: DepartmentState = { error: null, success: false };

export type Department = {
  id: string;
  name: string;
  summary: string | null;
  manager: string | null;
  status: string;
  sort: number;
};

export type Person = { id: string; name: string; role: string | null };

const BADGE: Record<string, string> = {
  active: "b-live",
  forming: "b-ready",
  reserved: "b-plan",
};

const STATUSES = ["active", "forming", "reserved"];

/** The shared field set, so the add form and the edit form cannot drift. */
function Fields({ value }: { value?: Department }) {
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`name-${value?.id ?? "new"}`}>Name</label>
          <input
            id={`name-${value?.id ?? "new"}`}
            name="name"
            required
            maxLength={80}
            defaultValue={value?.name ?? ""}
            placeholder="Learning Sciences"
          />
        </div>
        <div className="field">
          <label htmlFor={`manager-${value?.id ?? "new"}`}>Manager</label>
          <input
            id={`manager-${value?.id ?? "new"}`}
            name="manager"
            maxLength={80}
            defaultValue={value?.manager ?? ""}
            placeholder="Unfilled"
          />
        </div>
        <div className="field">
          <label htmlFor={`status-${value?.id ?? "new"}`}>Status</label>
          <select
            id={`status-${value?.id ?? "new"}`}
            name="status"
            defaultValue={value?.status ?? "active"}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`sort-${value?.id ?? "new"}`}>Order</label>
          <input
            id={`sort-${value?.id ?? "new"}`}
            name="sort"
            type="number"
            min={0}
            max={9999}
            defaultValue={value?.sort ?? 0}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`summary-${value?.id ?? "new"}`}>What it covers</label>
        <textarea
          id={`summary-${value?.id ?? "new"}`}
          name="summary"
          rows={2}
          maxLength={400}
          defaultValue={value?.summary ?? ""}
          placeholder="One line on what this department is responsible for."
        />
      </div>
    </>
  );
}

export function AddDepartmentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createDepartment,
    initialState,
  );
  // Closing unmounts the form, so the next open starts from the defaults —
  // no manual reset needed.
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <p style={{ margin: "0 0 14px" }}>
        <button type="button" className="addbtn" onClick={() => setOpen(true)}>
          Add a department
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="formcard">
      <Fields />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Create department"}
      </button>
      <button
        type="button"
        className="addbtn2"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        Cancel
      </button>
      {state.error && <p className="err">{state.error}</p>}
    </form>
  );
}

export function DepartmentCard({
  department,
  people,
  canEdit,
}: {
  department: Department;
  people: Person[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateDepartment,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteDepartment,
    initialState,
  );
  useCloseOnSuccess(state, () => setEditing(false));

  if (editing) {
    return (
      <div className="modcard">
        <form action={formAction}>
          <input type="hidden" name="id" value={department.id} />
          <Fields value={department} />
          <button type="submit" className="addbtn" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="addbtn2"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Cancel
          </button>
          {state.error && <p className="err">{state.error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="modcard">
      <h3>
        {department.name}{" "}
        <span className={`badge ${BADGE[department.status] ?? "b-reg"}`}>
          {department.status}
        </span>
      </h3>
      <p>{department.summary ?? "—"}</p>
      <div className="parts">
        <span>
          {people.length} {people.length === 1 ? "person" : "people"}
        </span>
        {department.manager && <span>Manager: {department.manager}</span>}
      </div>
      {people.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5 }}>
          {people.map((p) => (
            <div key={p.id} style={{ color: "var(--muted)" }}>
              {p.name}
              {p.role ? ` — ${p.role}` : ""}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="minibtn"
            style={{ marginLeft: 0 }}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <form action={delAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={department.id} />
            <button
              type="submit"
              className="minibtn del"
              disabled={delPending || people.length > 0}
              title={
                people.length > 0
                  ? "Move everyone out of this department before deleting it."
                  : "Delete this department"
              }
            >
              {delPending ? "Deleting…" : "Delete"}
            </button>
          </form>
          {delState.error && <p className="err">{delState.error}</p>}
        </div>
      )}
    </div>
  );
}
