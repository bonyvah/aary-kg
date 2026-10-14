"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { answeredAt, distributeCounts, mockJoiners } from "@/mocks/hostGame";
import type { Quiz } from "@/types/quiz";
import { hostReducer, initialHostState, type HostPhase, type HostState } from "./reducer";
import { useMockJoiners } from "./useMockJoiners";

const JOIN_INTERVAL_MS = 700;

/**
 * The host side of one game on mock data: players joining, the clock, answers coming in, the
 * counts, the leaderboard. Stands in for the host socket until Phase 5.
 */
export function useHostFlow(quiz: Quiz) {
  const [state, dispatch] = useReducer(hostReducer, initialHostState);
  const [paused, setPaused] = useState(false);
  const joined = useMockJoiners(mockJoiners, JOIN_INTERVAL_MS, paused || state.phase !== "lobby");
  // In the lobby players arrive one by one; once the game runs, everyone who had joined plays.
  const players = state.phase === "lobby" ? joined : mockJoiners.slice(0, state.total);
  const question = quiz.questions[state.round - 1] ?? null;
  const totalQuestions = quiz.questions.length;

  const closeQuestion = useCallback(() => {
    if (!question) return;
    const answered = answeredAt(state.total, question.seconds - state.secondsLeft, question.seconds);
    dispatch({ type: "CLOSED", counts: distributeCounts(Math.max(state.answered, answered), question.correct) });
  }, [question, state.total, state.secondsLeft, state.answered]);

  // One tick per second while a question is open; answers come in on the way.
  useEffect(() => {
    if (paused || state.phase !== "question" || !question) return;
    const timer = setInterval(() => {
      const elapsed = question.seconds - state.secondsLeft + 1;
      dispatch({ type: "TICK", answered: answeredAt(state.total, elapsed, question.seconds) });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, state.phase, state.secondsLeft, state.total, question]);

  // Time ran out: the question closes by itself.
  useEffect(() => {
    if (!paused && state.phase === "question" && state.secondsLeft === 0) closeQuestion();
  }, [paused, state.phase, state.secondsLeft, closeQuestion]);

  const start = useCallback(() => {
    const first = quiz.questions[0];
    if (first && joined.length > 0) dispatch({ type: "STARTED", total: joined.length, seconds: first.seconds });
  }, [quiz, joined.length]);

  /** The host's «continue» button: skip the rest of the question, then step through the screens. */
  const advance = useCallback(() => {
    if (state.phase === "question") closeQuestion();
    else if (state.phase === "counts") dispatch({ type: "LEADERBOARD_SHOWN" });
    else if (state.phase === "leaderboard") {
      const next = quiz.questions[state.round];
      if (next) dispatch({ type: "QUESTION_STARTED", seconds: next.seconds });
      else dispatch({ type: "GAME_ENDED" });
    }
  }, [state.phase, state.round, quiz, closeQuestion]);

  /** Dev bar only: jump to a screen as if the game had got there. */
  const jumpTo = useCallback(
    (phase: HostPhase) => {
      const first = quiz.questions[0];
      if (!first) return;
      const total = mockJoiners.length;
      const round = phase === "lobby" ? 0 : 1;
      const base: HostState = { phase, round, secondsLeft: 0, answered: 0, counts: null, total: phase === "lobby" ? 0 : total };
      if (phase === "question") dispatch({ type: "JUMPED", state: { ...base, secondsLeft: first.seconds - 8, answered: answeredAt(total, 8, first.seconds) } });
      else if (phase === "counts")
        dispatch({ type: "JUMPED", state: { ...base, counts: distributeCounts(answeredAt(total, first.seconds, first.seconds), first.correct) } });
      else if (phase === "podium") dispatch({ type: "JUMPED", state: { ...base, round: totalQuestions } });
      else dispatch({ type: "JUMPED", state: base });
    },
    [quiz, totalQuestions],
  );

  return { state, players, question, totalQuestions, paused, setPaused, start, advance, jumpTo };
}
