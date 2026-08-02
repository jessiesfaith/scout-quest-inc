"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addContract,
  setContractStatus,
  deleteContract,
  type ActionState,
} from "./actions";

const initialState: ActionState = { error: null };

export type MemberOption = { id: string; name: string };

const TYPES = ["NDA", "Contract", "Offer letter", "Amendment", "Other"];

export function AddContractForm({ members }: { members: MemberOption[] }) {
  const [state, formAction, pending] = useActionState(
    addContract,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state]);

  if (members.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        Add someone under HR › Team first — contracts attach to a team member.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        submitted.current = true;
        formAction(fd);
      }}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-semibold">Add contract</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="team_member_id"
            className="mb-1.5 block text-xs text-muted"
          >
            Team member *
          </label>
          <select
            id="team_member_id"
            name="team_member_id"
            required
            defaultValue=""
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Choose…
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="mb-1.5 block text-xs text-muted">
            Type *
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue="NDA"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-xs text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue="pending"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="pending">pending</option>
            <option value="complete">complete</option>
          </select>
        </div>
        <div>
          <label htmlFor="file" className="mb-1.5 block text-xs text-muted">
            File (optional)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent focus:border-accent"
          />
        </div>
      </div>

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add contract"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Files go to the private <code>contracts</code> bucket — never public,
        opened only through short-lived links.
      </p>
    </form>
  );
}

export function StatusToggle({
  contractId,
  status,
}: {
  contractId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    setContractStatus,
    initialState,
  );
  const next = status === "complete" ? "pending" : "complete";

  return (
    <form action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        title={`Mark ${next}`}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
          status === "complete"
            ? "bg-success/10 text-success hover:bg-surface-raised"
            : "bg-gold/15 text-gold hover:bg-success/10 hover:text-success"
        }`}
      >
        {pending ? "…" : status}
      </button>
      {state.error && (
        <span className="mt-1 text-xs text-danger">{state.error}</span>
      )}
    </form>
  );
}

export function DeleteContractButton({ contractId }: { contractId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteContract,
    initialState,
  );
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
      <input type="hidden" name="contract_id" value={contractId} />
      <span className="text-xs text-danger">Deletes the file too.</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Confirm"}
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
