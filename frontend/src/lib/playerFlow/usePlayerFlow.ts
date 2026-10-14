"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { isCharacter, randomCharacter, type Character } from "@/components/game/avatar/characters";
import {
  MOCK_PIN_NOT_FOUND,
  MOCK_TAKEN_NICKNAMES,
  MOCK_TOTAL_QUESTIONS,
  mockCorrectAnswer,
  mockPoints,
  mockQuestion,
} from "@/mocks/playerFlow";
import type { GamePhase } from "@/types/game";
import { flowReducer, initialState } from "./reducer";

const LOBBY_MS = 10000;
const ANSWERED_CLOSE_MS = 2500;
const RESULT_MS = 4000;
const LEADERBOARD_MS = 5000;
const DEMO_NICKNAME = "Мырзабек";
const DEMO_CHARACTER: Character = { shape: "star", color: "yellow", face: "stars" };
const PIN_LENGTH = 6;

/**
 * Stands in for the WebSocket connection until Phase 5: it plays the server's part on mock data
 * (validation, question start, timer, reveal) and feeds the same events into the reducer.
 */
export function usePlayerFlow() {
  const [state, dispatch] = useReducer(flowReducer, initialState);
  const [paused, setPaused] = useState(false);
  const { phase, question, secondsLeft, selected, answerSecondsLeft } = state;
  const round = question?.index ?? 0;

  const closeQuestion = useCallback(() => {
    if (!question) return;
    const correct = mockCorrectAnswer(question.index);
    dispatch({
      type: "QUESTION_CLOSED",
      reveal: { correct, points: mockPoints(selected === correct, answerSecondsLeft ?? 0) },
    });
  }, [question, selected, answerSecondsLeft]);

  // The clock only draws what the "server" says: one tick per second while a question is open.
  useEffect(() => {
    if (paused || (phase !== "question" && phase !== "answered")) return;
    const timer = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(timer);
  }, [paused, phase]);

  // Time ran out: the question closes whether or not the player answered.
  useEffect(() => {
    if (paused) return;
    if ((phase === "question" || phase === "answered") && secondsLeft === 0) closeQuestion();
  }, [paused, phase, secondsLeft, closeQuestion]);

  // Phase timers. They must not depend on the clock ticks, or every tick would restart them.
  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === "lobby") {
      timer = setTimeout(() => {
        const first = mockQuestion(1);
        if (first) dispatch({ type: "QUESTION_STARTED", question: first });
      }, LOBBY_MS);
    } else if (phase === "answered") {
      timer = setTimeout(closeQuestion, ANSWERED_CLOSE_MS);
    } else if (phase === "result") {
      timer = setTimeout(() => dispatch({ type: "LEADERBOARD_SHOWN" }), RESULT_MS);
    } else if (phase === "leaderboard") {
      timer = setTimeout(() => {
        const next = mockQuestion(round + 1);
        if (next) dispatch({ type: "QUESTION_STARTED", question: next });
        else dispatch({ type: "GAME_ENDED" });
      }, LEADERBOARD_MS);
    }

    return () => clearTimeout(timer);
  }, [paused, phase, round, closeQuestion]);

  const submitPin = useCallback((pin: string) => {
    const clean = pin.replace(/\s/g, "");
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(clean)) {
      dispatch({ type: "REJECTED", error: "PIN_INVALID" });
    } else if (clean === MOCK_PIN_NOT_FOUND) {
      dispatch({ type: "REJECTED", error: "GAME_NOT_FOUND" });
    } else {
      dispatch({ type: "PIN_ACCEPTED", pin: clean });
    }
  }, []);

  const submitNickname = useCallback((nickname: string) => {
    const clean = nickname.trim();
    if (clean.length === 0) {
      dispatch({ type: "REJECTED", error: "NICKNAME_INVALID" });
    } else if (MOCK_TAKEN_NICKNAMES.some((taken) => taken.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      dispatch({ type: "REJECTED", error: "NICKNAME_TAKEN" });
    } else {
      // The server gives every new player a random character; the lobby lets them change it.
      dispatch({ type: "NICKNAME_ACCEPTED", nickname: clean, character: randomCharacter() });
    }
  }, []);

  const answer = useCallback((position: AnswerPosition) => {
    dispatch({ type: "ANSWER_SELECTED", position });
  }, []);

  /** Dev bar only: replay the events a real game would have sent to reach a screen. */
  const jumpTo = useCallback((target: GamePhase) => {
    dispatch({ type: "RESET" });
    if (target === "join") return;
    dispatch({ type: "PIN_ACCEPTED", pin: "123456" });
    if (target === "nickname") return;
    dispatch({ type: "NICKNAME_ACCEPTED", nickname: DEMO_NICKNAME, character: DEMO_CHARACTER });
    if (target === "lobby") return;
    if (target === "character") {
      dispatch({ type: "CHARACTER_OPENED" });
      return;
    }
    const first = mockQuestion(1);
    if (!first) return;
    dispatch({ type: "QUESTION_STARTED", question: first });
    if (target === "question") return;
    dispatch({ type: "ANSWER_SELECTED", position: 2 });
    if (target === "answered") return;
    dispatch({
      type: "QUESTION_CLOSED",
      reveal: { correct: mockCorrectAnswer(1), points: mockPoints(true, first.seconds) },
    });
    if (target === "result") return;
    dispatch({ type: "LEADERBOARD_SHOWN" });
    if (target === "leaderboard") return;
    dispatch({ type: "GAME_ENDED" });
  }, []);

  const openCharacter = useCallback(() => dispatch({ type: "CHARACTER_OPENED" }), []);
  const closeCharacter = useCallback(() => dispatch({ type: "CHARACTER_CLOSED" }), []);

  /** The server checks what a client sends: only ids from the fixed lists are accepted. */
  const changeCharacter = useCallback((character: Character) => {
    if (isCharacter(character)) dispatch({ type: "CHARACTER_CHANGED", character });
  }, []);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    state,
    paused,
    setPaused,
    totalQuestions: MOCK_TOTAL_QUESTIONS,
    submitPin,
    submitNickname,
    answer,
    openCharacter,
    changeCharacter,
    closeCharacter,
    jumpTo,
    reset,
  };
}
