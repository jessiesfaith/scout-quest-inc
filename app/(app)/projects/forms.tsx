"use client";

import { useActionState, useEffect, useRef } from "react";
import { addProject, deleteProject, type ActionState } from "./actions";

const init: ActionState = { error: null };

export function AddProjectForm() {
  const [state, formAction, pending] = useActionState(addProject, init);
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
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="name">Project *</label>
          <input id="name" name="name" required placeholder="District pilot" />
        </div>
        <div className="field">
          <label htmlFor="p-start">Start</label>
          <input id="p-start" name="start_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="p-end">End</label>
          <input id="p-end" name="end_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="p-status">Status</label>
          <select id="p-status" name="status" defaultValue="planned">
            <option value="planned">planned</option>
            <option value="building">building</option>
            <option value="live">live</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="summary">Summary</label>
        <input id="summary" name="summary" placeholder="What it delivers, in a line" />
      </div>
      {state.error && <p className="err">{state.error}</p>}
      <button type="submit" className="addbtn" disabled={pending}>
        {pending ? "Adding…" : "Add project"}
      </button>
    </form>
  );
}

export function DeleteProject({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteProject, init);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="project_id" value={id} />
      <button type="submit" className="minibtn del" disabled={pending}>
        {pending ? "…" : "Remove"}
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
