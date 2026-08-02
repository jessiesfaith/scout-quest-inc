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
  const [state, formAction, pending] = useActionState(addContract, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state]);

  if (members.length === 0) {
    return (
      <p className="note">
        Add someone under HR › Team first — contracts attach to a team member.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      className="formcard"
      action={(fd) => {
        submitted.current = true;
        formAction(fd);
      }}
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor="team_member_id">Team member *</label>
          <select id="team_member_id" name="team_member_id" required defaultValue="">
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
        <div className="field">
          <label htmlFor="type">Type *</label>
          <select id="type" name="type" required defaultValue="NDA">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue="pending">
            <option value="pending">pending</option>
            <option value="complete">complete</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="file">File (optional)</label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          />
        </div>
      </div>

      {state.error && <p className="err">{state.error}</p>}

      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Saving…" : "Add contract"}
      </button>
      <span className="note" style={{ marginLeft: 10, fontSize: 12 }}>
        Files go to the private <code>contracts</code> bucket — never public.
      </span>
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
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        title={`Mark ${next}`}
        className={`tag ${status === "complete" ? "t-hi" : "t-med"}`}
        style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        {pending ? "…" : status}
      </button>
      {state.error && <span className="err">{state.error}</span>}
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
        className="minibtn del"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="contract_id" value={contractId} />
      <button type="submit" className="minibtn del" disabled={pending}>
        {pending ? "Deleting…" : "Confirm — deletes the file too"}
      </button>
      <button
        type="button"
        className="minibtn"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
