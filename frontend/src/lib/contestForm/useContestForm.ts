"use client";

import { useCallback, useReducer } from "react";
import { contestFormReducer, initialContestForm, type ContestFormEvent } from "./reducer";

/** Local state of the «new contest» form. «Save» only validates in the mock; Phase 5 sends it to the API. */
export function useContestForm() {
  const [state, dispatch] = useReducer(contestFormReducer, initialContestForm);
  const send = useCallback((event: ContestFormEvent) => dispatch(event), []);
  return { state, send };
}
