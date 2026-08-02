"use client";

import { useActionState, useEffect, useRef } from "react";
import { logChange, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export function LogChangeForm() {
  const [state, formAction, pending] = useActionState(logChange, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
    if (!pending) submitted.current = false;
  }, [pending, state]);

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
          <label htmlFor="product">Product</label>
          <input id="product" name="product" defaultValue="company" />
        </div>
        <div className="field">
          <label htmlFor="module">Module</label>
          <input id="module" name="module" placeholder="HR" />
        </div>
        <div className="field">
          <label htmlFor="tab">Tab</label>
          <input id="tab" name="tab" placeholder="Contracts" />
        </div>
        <div className="field">
          <label htmlFor="change_type">Type</label>
          <select id="change_type" name="change_type" defaultValue="update">
            <option value="new">new</option>
            <option value="update">update</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="change_class">Class</label>
          <select id="change_class" name="change_class" defaultValue="">
            <option value="">—</option>
            <option value="1">1 — routine</option>
            <option value="2">2 — notable</option>
            <option value="3">3 — governed</option>
            <option value="3+">3+ — high risk</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">What changed *</label>
        <textarea
          id="description"
          name="description"
          required
          rows={2}
          placeholder="Added HR Contracts with private file storage"
        />
      </div>

      {state.error && <p className="err">{state.error}</p>}

      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Recording…" : "Record entry"}
      </button>
      <span className="note" style={{ marginLeft: 10, fontSize: 12 }}>
        Entries are permanent — nobody can edit or delete them, including you.
      </span>
    </form>
  );
}
