"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createGame, createNextGame, getHostTicket } from "@/lib/api/games";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";
import type { HostEvent, HostMessage, Ruling } from "@/lib/game/events";
import { openGameSocket, type GameSocket } from "@/lib/game/socket";
import type { Quiz } from "@/types/quiz";
import { readHostGame, writeHostGame, type HostGame } from "./hostGame";
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
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setFailed(null);
    // A refresh keeps the game, whatever it is showing, even the podium: its id and PIN are remembered
    // for this tab, and the server sends the picture of where the game is as soon as the screen
    // connects again. «Start game» on the quiz page forgets the old one first.
    const remembered = () => readHostGame(quiz.id);
    const remember = (game: HostGame | null) => writeHostGame(quiz.id, game);

    const open = (gameId: string, pin: string, resumed: boolean) => {
      dispatch({ type: "CREATED", gameId, pin, totalQuestions: quiz.questions.length });
      let heard = false;
      socket.current = openGameSocket<HostEvent>({
        path: `/ws/host/${gameId}`,
        token: () => getHostTicket(gameId),
        onEvent: (event) => {
          if (cancelled) return;
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
    /** From the podium: the players still connected go on to a lobby for `quizId`, on the same PIN. */
    nextGame: useCallback(
      async (quizId: string) => {
        try {
          const next = await createNextGame(state.gameId, quizId);
          writeHostGame(quiz.id, null);
          writeHostGame(quizId, next);
          creation.current = null;
          // The same quiz stays on this page: connect again, to the remembered new game.
          if (quizId === quiz.id) setAttempt((n) => n + 1);
          else router.push(`/host/${quizId}`);
        } catch (error) {
          setRefused(toKnownCode(error));
        }
      },
      [state.gameId, quiz.id, router],
    ),
  };
}
