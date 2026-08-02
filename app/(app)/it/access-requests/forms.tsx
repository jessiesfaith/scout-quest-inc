"use client";

import { useActionState } from "react";
import { decideRequest, type ActionState } from "./actions";

const init: ActionState = { error: null };

export function Decide({
  requestId,
  status,
  note,
}: {
  requestId: string;
  status: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState(decideRequest, init);

  return (
    <form action={formAction} className="addmember" style={{ margin: 0 }}>
      <input type="hidden" name="request_id" value={requestId} />
      {/* Seeded with the existing note: an empty box would silently erase
          the only record of why a decision was made. */}
      <input
        name="note"
        defaultValue={note ?? ""}
        placeholder="Note (optional)"
        aria-label="Note"
      />
      <select name="status" defaultValue={status} aria-label="Decision">
        <option value="pending">pending</option>
        <option value="approved">approved</option>
        <option value="declined">declined</option>
      </select>
      <button type="submit" className="minibtn" disabled={pending}>
        {pending ? "…" : "Save"}
      </button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
