"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTeamMember, type AddMemberState } from "./actions";

const initialState: AddMemberState = { error: null, success: false };

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState(
    addTeamMember,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="addmember">
      <input name="name" required placeholder="Name" aria-label="Name" />
      <input name="role" placeholder="Role" aria-label="Role" />
      <input
        name="working_on"
        placeholder="Working on"
        aria-label="Working on"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        aria-label="Email"
      />
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </button>
      {state.error && (
        <span className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
