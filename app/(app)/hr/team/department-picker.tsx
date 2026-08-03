"use client";

import { useActionState, useState } from "react";
import { setDepartment, type SetDepartmentState } from "./actions";

const initialState: SetDepartmentState = { error: null };

export function DepartmentPicker({
  memberId,
  current,
  departments,
  disabled,
}: {
  memberId: string;
  current: string | null;
  departments: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setDepartment,
    initialState,
  );
  // Controlled, not defaultValue: submitting a form with a server action
  // makes React reset the form, which would snap the select back to the
  // value the page was rendered with until revalidation catches up.
  // Re-sync during render when the saved value actually changes — React's
  // "adjusting state when a prop changes" pattern, not an effect.
  const [value, setValue] = useState(current ?? "");
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setValue(current ?? "");
  }

  if (disabled) {
    return (
      <span style={{ color: "var(--muted)" }}>
        {departments.find((d) => d.id === current)?.name ?? "—"}
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="member_id" value={memberId} />
      <select
        name="department_id"
        value={value}
        disabled={pending}
        aria-label="Department"
        onChange={(e) => {
          setValue(e.target.value);
          e.currentTarget.form?.requestSubmit();
        }}
        style={{ font: "inherit", padding: "3px 6px" }}
      >
        <option value="">—</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {state.error && (
        <div style={{ color: "var(--danger)", fontSize: 11.5 }}>
          {state.error}
        </div>
      )}
    </form>
  );
}
