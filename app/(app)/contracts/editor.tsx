"use client";

import { useActionState, useState } from "react";
import {
  createCompanyContract,
  updateCompanyContract,
  deleteCompanyContract,
  type ContractState,
} from "./actions";
import { COMPANY_CATEGORIES, CATEGORY_LABEL, STATUSES } from "./vocab";
import { useCloseOnSuccess } from "../use-close-on-success";

const initialState: ContractState = { error: null, success: false };

export type Contract = {
  id: string;
  team_member_id: string | null;
  counterparty: string | null;
  category: string;
  type: string | null;
  status: string;
  file_path: string | null;
  effective_on: string | null;
  expires_on: string | null;
  obligations: string | null;
  created_at: string;
};

function Fields({ value }: { value?: Contract }) {
  const k = value?.id ?? "new";
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`cp-${k}`}>Counterparty</label>
          <input
            id={`cp-${k}`}
            name="counterparty"
            required
            maxLength={120}
            defaultValue={value?.counterparty ?? ""}
            placeholder="Riverside Unified School District"
          />
        </div>
        <div className="field">
          <label htmlFor={`cat-${k}`}>Category</label>
          <select
            id={`cat-${k}`}
            name="category"
            defaultValue={
              value && value.category !== "employment"
                ? value.category
                : "vendor"
            }
          >
            {COMPANY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`type-${k}`}>Type</label>
          <input
            id={`type-${k}`}
            name="type"
            maxLength={80}
            defaultValue={value?.type ?? ""}
            placeholder="Data Processing Agreement"
          />
        </div>
        <div className="field">
          <label htmlFor={`st-${k}`}>Status</label>
          <select
            id={`st-${k}`}
            name="status"
            defaultValue={value?.status ?? "pending"}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`eff-${k}`}>Effective from</label>
          <input
            id={`eff-${k}`}
            name="effective_on"
            type="date"
            defaultValue={value?.effective_on ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor={`exp-${k}`}>Expires</label>
          <input
            id={`exp-${k}`}
            name="expires_on"
            type="date"
            defaultValue={value?.expires_on ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor={`file-${k}`}>
            {value?.file_path ? "Replace the file" : "Signed file"}
          </label>
          <input
            id={`file-${k}`}
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`ob-${k}`}>Obligations</label>
        <textarea
          id={`ob-${k}`}
          name="obligations"
          rows={2}
          maxLength={600}
          defaultValue={value?.obligations ?? ""}
          placeholder="What this agreement commits the company to — breach notice windows, deletion deadlines, audit rights."
        />
      </div>
    </>
  );
}

export function AddContractForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createCompanyContract,
    initialState,
  );
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <p style={{ margin: "0 0 14px" }}>
        <button type="button" className="addbtn" onClick={() => setOpen(true)}>
          Record an agreement
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="formcard">
      <Fields />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Save agreement"}
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

function Row({
  contract,
  partyName,
  canEdit,
  columns,
  todayStr,
  soonStr,
}: {
  contract: Contract;
  partyName: string;
  canEdit: boolean;
  columns: number;
  todayStr: string;
  soonStr: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateCompanyContract,
    initialState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteCompanyContract,
    initialState,
  );
  useCloseOnSuccess(state, () => setEditing(false));

  const lapsed = !!contract.expires_on && contract.expires_on < todayStr;
  const expiring =
    !!contract.expires_on &&
    contract.expires_on >= todayStr &&
    contract.expires_on <= soonStr;

  // Employment contracts are a person's record: they appear here for HR's
  // benefit but are maintained on HR › Contracts, where the team member
  // they belong to is part of the form.
  const editable = canEdit && contract.category !== "employment";

  return (
    <>
      <tr>
        <td>
          <b>{partyName}</b>
        </td>
        <td>{contract.type ?? "—"}</td>
        <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
          {contract.obligations ?? "—"}
        </td>
        <td style={{ fontSize: 12, color: "var(--muted)" }}>
          {contract.effective_on ?? "—"} → {contract.expires_on ?? "—"}
          {/* t-lo is red, t-hi is green, everywhere else in the app: a
              complete contract is t-hi, a high-severity finding is t-lo.
              An agreement past its end date is the urgent one (TCK-0010). */}
          {lapsed && (
            <span className="tag t-lo" style={{ marginLeft: 5 }}>
              expired
            </span>
          )}
          {expiring && (
            <span className="tag t-med" style={{ marginLeft: 5 }}>
              expiring
            </span>
          )}
        </td>
        <td>
          {contract.file_path ? (
            <a
              href={`/hr/contracts/download/${contract.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="crumb"
            >
              Open
            </a>
          ) : (
            "—"
          )}
        </td>
        <td>
          <span
            className={`tag ${contract.status === "complete" ? "t-hi" : "t-med"}`}
          >
            {contract.status}
          </span>
        </td>
        {canEdit && (
          <td style={{ whiteSpace: "nowrap" }}>
            {!editable ? (
              <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                on HR › Contracts
              </span>
            ) : (
              <>
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
                    Delete
                  </button>
                ) : (
                  <form action={delAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={contract.id} />
                    <button
                      type="submit"
                      className="minibtn del"
                      disabled={delPending}
                    >
                      {delPending ? "Deleting…" : "Confirm"}
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
              </>
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
              <input type="hidden" name="id" value={contract.id} />
              <Fields value={contract} />
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

export function ContractsTable({
  rows,
  partyNames,
  canEdit,
  todayStr,
  soonStr,
}: {
  rows: Contract[];
  /** contract id → display name, resolved on the server where the join is. */
  partyNames: Record<string, string>;
  canEdit: boolean;
  todayStr: string;
  soonStr: string;
}) {
  const columns = canEdit ? 7 : 6;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Party</th>
            <th>Type</th>
            <th>Obligations</th>
            <th>Dates</th>
            <th>File</th>
            <th>Status</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Row
              key={c.id}
              contract={c}
              partyName={partyNames[c.id] ?? "—"}
              canEdit={canEdit}
              columns={columns}
              todayStr={todayStr}
              soonStr={soonStr}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
