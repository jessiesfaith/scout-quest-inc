"use client";

import { useState } from "react";

// Collapse a form once its server action reports success.
//
// Deliberately NOT an effect. Setting state inside useEffect schedules a
// second render pass and the lint rule rejects it; React's documented way
// to react to a changed value is to adjust state during render, which is
// the same "adjusting state when a prop changes" shape `DepartmentPicker`
// uses. The action state object is a fresh reference on every submission,
// so identity comparison is what tells one result from the next — two
// consecutive successes are two different objects and both close the form.
export function useCloseOnSuccess(
  state: { success: boolean },
  close: () => void,
) {
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.success) close();
  }
}
