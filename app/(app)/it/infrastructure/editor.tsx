"use client";

import { useActionState, useState } from "react";
import {
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  type InfraState,
} from "./actions";
import { KINDS, STATUSES, ENVIRONMENTS } from "./vocab";
import { useCloseOnSuccess } from "../../use-close-on-success";

const initialState: InfraState = { error: null, success: false };

export type Item = {
  id: string;
  name: string;
  kind: string;
  environment: string;
  provider: string | null;
  data_classes: string | null;
  status: string;
  notes: string | null;
  sort: number;
};

function Fields({ value }: { value?: Item }) {
  const k = value?.id ?? "new";
  // A new environment shouldn't require a code change, so the list is a
  // datalist (suggestions) rather than a select (a closed set).
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`name-${k}`}>Component</label>
          <input
            id={`name-${k}`}
            name="name"
            required
            maxLength={100}
            defaultValue={value?.name ?? ""}
            placeholder="Company OS database"
          />
        </div>
        <div className="field">
          <label htmlFor={`kind-${k}`}>Kind</label>
          <select id={`kind-${k}`} name="kind" defaultValue={value?.kind ?? "service"}>
            {KINDS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`env-${k}`}>Environment</label>
          <input
            id={`env-${k}`}
            name="environment"
            required
            maxLength={40}
            list="infra-environments"
            defaultValue={value?.environment ?? "production"}
          />
          <datalist id="infra-environments">
            {ENVIRONMENTS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor={`status-${k}`}>Status</label>
          <select
            id={`status-${k}`}
            name="status"
            defaultValue={value?.status ?? "live"}
          >
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`provider-${k}`}>Provider</label>
          <input
            id={`provider-${k}`}
            name="provider"
            maxLength={80}
            defaultValue={value?.provider ?? ""}
            placeholder="Supabase Postgres"
          />
        </div>
        <div className="field">
          <label htmlFor={`dc-${k}`}>Data classes</label>
          <input
            id={`dc-${k}`}
            name="data_classes"
            maxLength={40}
            defaultValue={value?.data_classes ?? ""}
            placeholder="D0-D2"
          />
        </div>
        <div className="field">
          <label htmlFor={`sort-${k}`}>Order</label>
          <input
            id={`sort-${k}`}
            name="sort"
            type="number"
            min={0}
            max={9999}
            defaultValue={value?.sort ?? 0}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`notes-${k}`}>Notes</label>
        <textarea
          id={`notes-${k}`}
          name="notes"
          rows={2}
          maxLength={400}
          defaultValue={value?.notes ?? ""}
          placeholder="Anything worth knowing when this breaks."
        />
      </div>
      <p className="note" style={{ margin: "2px 0 10px" }}>
        Marking something <b>D3</b> records that it may touch regulated
        student or patient data. Nothing in this OS may — only the governed
        local plane. Recording it here does not make it allowed.
      </p>
    </>
  );
}

export function AddInfrastructureForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createInfrastructure,
    initialState,
  );
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <p style={{ margin: "0 0 14px" }}>
        <button type="button" className="addbtn" onClick={() => setOpen(true)}>
          Add a component
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="formcard">
      <Fields />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Add component"}
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

const STATUS_BADGE: Record<string, string> = {
  live: "b-live",
  building: "b-ready",
  planned: "b-plan",
  retired: "b-reg",
};

/** One row, plus the full-width editing row it expands into. */
function InfraRow({
  item,
  canEdit,
  columns,
}: {
  item: Item;
  canEdit: boolean;
  columns: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateInfrastructure,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteInfrastructure,
    initialState,
  );
  useCloseOnSuccess(state, () => setEditing(false));

  return (
    <>
      <tr>
        <td>
          <b>{item.name}</b>
          {item.notes && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {item.notes}
            </div>
          )}
        </td>
        <td style={{ color: "var(--muted)" }}>{item.kind}</td>
        <td>{item.provider ?? "—"}</td>
        <td>
          <span
            className={item.data_classes?.includes("D3") ? "no-d3" : undefined}
          >
            {item.data_classes ?? "—"}
          </span>
        </td>
        <td>
          <span className={`badge ${STATUS_BADGE[item.status] ?? "b-reg"}`}>
            {item.status}
          </span>
        </td>
        {canEdit && (
          <td style={{ whiteSpace: "nowrap" }}>
            <button
              type="button"
              className="minibtn"
              style={{ marginLeft: 0 }}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Close" : "Edit"}
            </button>
            {!confirming ? (
              <button
                type="button"
                className="minibtn del"
                onClick={() => setConfirming(true)}
              >
                Remove
              </button>
            ) : (
              <form action={delAction} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="minibtn del"
                  disabled={delPending}
                >
                  {delPending ? "Removing…" : "Confirm"}
                </button>
                <button
                  type="button"
                  className="minibtn"
                  onClick={() => setConfirming(false)}
                  disabled={delPending}
                >
                  Keep
                </button>
              </form>
            )}
          </td>
        )}
      </tr>
      {delState.error && (
        <tr>
          <td colSpan={columns} className="err">
            {delState.error}
          </td>
        </tr>
      )}
      {editing && (
        <tr>
          <td colSpan={columns}>
            <form action={formAction}>
              <input type="hidden" name="id" value={item.id} />
              <Fields value={item} />
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
          </td>
        </tr>
      )}
    </>
  );
}

export function InfraTable({
  rows,
  canEdit,
}: {
  rows: Item[];
  canEdit: boolean;
}) {
  const columns = canEdit ? 6 : 5;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Kind</th>
            <th>Provider</th>
            <th>Data classes</th>
            <th>Status</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <InfraRow key={i.id} item={i} canEdit={canEdit} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
