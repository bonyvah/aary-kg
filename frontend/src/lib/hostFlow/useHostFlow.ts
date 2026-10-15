"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createGame } from "@/lib/api/games";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";
import type { HostEvent, HostMessage } from "@/lib/game/events";
import { openGameSocket, type GameSocket } from "@/lib/game/socket";
import type { Quiz } from "@/types/quiz";
import { hostReducer, initialHostState } from "./reducer";

/**
 * The host's side of one live game. It creates the lobby on the server, connects to it, and turns
 * what the server sends (players joining, answers coming in, counts, leaderboard) into screen state.
 * The host's buttons only send commands: the server runs the game.
 */
export function useHostFlow(quiz: Quiz) {
  const [state, dispatch] = useReducer(hostReducer, initialHostState);
  const [failed, setFailed] = useState<KnownApiCode | null>(null);
  /** The code of the last command the server refused, so the screen can say why. */
  const [refused, setRefused] = useState<string | null>(null);
  const socket = useRef<GameSocket | null>(null);
  // One lobby per screen. React runs effects twice in development (and on a retry we start over),
  // so the request is kept here and shared instead of being sent again.
  const creation = useRef<ReturnType<typeof createGame> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(null);
    creation.current ??= createGame(quiz.id);
    creation.current
      .then(({ gameId, pin }) => {
        if (cancelled) return;
        dispatch({ type: "CREATED", gameId, pin, totalQuestions: quiz.questions.length });
        socket.current = openGameSocket<HostEvent>({
          path: `/ws/host/${gameId}`,
          onEvent: (event) => {
            dispatch({ type: "SERVER", event });
            if (event.type === "error") setRefused(event.code);
          },
          onClosed: () => {
            socket.current = null;
          },
        });
      })
      .catch((error: unknown) => {
        creation.current = null;
        if (!cancelled) setFailed(toKnownCode(error));
      });
    return () => {
      cancelled = true;
      socket.current?.close();
      socket.current = null;
    };
  }, [quiz.id, quiz.questions.length, attempt]);

  // The clock only draws what the server said: one tick per second while a question is open.
  const { phase } = state;
  useEffect(() => {
    if (phase !== "question") return;
    const timer = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const send = useCallback((message: HostMessage) => socket.current?.send(message), []);

  return {
    state,
    failed,
    refused,
    clearRefused: useCallback(() => setRefused(null), []),
    retry: useCallback(() => {
      creation.current = null;
      setAttempt((n) => n + 1);
    }, []),
    start: useCallback(() => send({ type: "start" }), [send]),
    /** The host's «continue»: close the question, show the leaderboard, go to the next question or the end. */
    advance: useCallback(() => {
      // Says which screen the button was on, so a double click doesn't skip the next one.
      if (phase === "question" || phase === "counts" || phase === "leaderboard") send({ type: "next", fromPhase: phase });
    }, [send, phase]),
    kick: useCallback((playerId: string) => send({ type: "kick", playerId }), [send]),
  };
}
