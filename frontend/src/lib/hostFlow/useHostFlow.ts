"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createGame } from "@/lib/api/games";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";
import type { HostEvent, HostMessage, Ruling } from "@/lib/game/events";
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
    const storageKey = `aary.hostGame.${quiz.id}`;

    // A refresh keeps the game: its id and PIN are remembered for this tab, and the server sends the
    // picture of where the game is as soon as the screen connects again.
    const remembered = (): { gameId: string; pin: string } | null => {
      try {
        const value: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null");
        if (typeof value === "object" && value !== null && "gameId" in value && "pin" in value) {
          const { gameId, pin } = value;
          if (typeof gameId === "string" && typeof pin === "string") return { gameId, pin };
        }
      } catch {
        // Storage can be blocked or hold something else: start a new game then.
      }
      return null;
    };
    const remember = (game: { gameId: string; pin: string } | null) => {
      try {
        if (game) window.sessionStorage.setItem(storageKey, JSON.stringify(game));
        else window.sessionStorage.removeItem(storageKey);
      } catch {
        // The game still works, it just does not survive a refresh.
      }
    };

    const open = (gameId: string, pin: string, resumed: boolean) => {
      dispatch({ type: "CREATED", gameId, pin, totalQuestions: quiz.questions.length });
      let heard = false;
      socket.current = openGameSocket<HostEvent>({
        path: `/ws/host/${gameId}`,
        onEvent: (event) => {
          if (cancelled) return;
          // A remembered game that is already over is not worth showing again: host a new one.
          if (resumed && !heard && event.type === "host.state" && event.phase === "ended") return startOver();
          heard = true;
          dispatch({ type: "SERVER", event });
          if (event.type === "error") setRefused(event.code);
        },
        onClosed: (code) => {
          socket.current = null;
          // The server no longer has this game (or it is not ours): host a new one.
          if (resumed && !heard && !cancelled && code === 4403) startOver();
        },
      });
    };

    const create = () => {
      creation.current ??= createGame(quiz.id);
      creation.current
        .then(({ gameId, pin }) => {
          if (cancelled) return;
          remember({ gameId, pin });
          open(gameId, pin, false);
        })
        .catch((error: unknown) => {
          creation.current = null;
          if (!cancelled) setFailed(toKnownCode(error));
        });
    };

    function startOver() {
      socket.current?.close();
      socket.current = null;
      remember(null);
      create();
    }

    const saved = remembered();
    if (saved) open(saved.gameId, saved.pin, true);
    else create();

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
    rule: useCallback((playerId: string, action: Ruling) => send({ type: "rule", playerId, action }), [send]),
  };
}
