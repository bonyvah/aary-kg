"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { isCharacter, type Character } from "@/components/game/avatar/characters";
import { checkPin, joinGame } from "@/lib/api/games";
import { ApiRequestError } from "@/lib/api/client";
import type { PlayerEvent, PlayerMessage } from "@/lib/game/events";
import { openGameSocket, type GameSocket } from "@/lib/game/socket";
import { flowReducer, initialState } from "./reducer";
import { toPlayerError } from "./errors";

const PIN_LENGTH = 6;
// The token lives in this tab only. A refresh or a dropped phone resumes the game with it.
const SESSION_KEY = "aary.player";

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null; // storage blocked (private mode): the game works, it just can't resume
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(SESSION_KEY, token);
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // see readToken
  }
}

/**
 * The player's connection to a live game. The server decides everything (when a question starts,
 * how long it lasts, what the answer scored); this only turns what it sends into screen state and
 * sends the player's own taps back.
 */
export function usePlayerFlow() {
  const [state, dispatch] = useReducer(flowReducer, initialState);
  const [resuming, setResuming] = useState(false);
  const socket = useRef<GameSocket | null>(null);
  // True from a refresh until the server has answered: a token that no longer works then means
  // «that game is over», which is not worth an error message on a fresh page.
  const resumingRef = useRef(false);
  const { phase } = state;

  const connect = useCallback((token: string) => {
    socket.current?.close();
    socket.current = openGameSocket<PlayerEvent>({
      path: "/ws/play",
      token,
      onEvent: (event) => {
        resumingRef.current = false;
        setResuming(false);
        dispatch({ type: "SERVER", event });
        if (event.type === "kicked") dispatch({ type: "LEFT", reason: "KICKED" });
        else if (event.type === "game.closed") dispatch({ type: "LEFT", reason: "GAME_CLOSED" });
        else if (event.type === "replaced") dispatch({ type: "LEFT", reason: "REPLACED" });
      },
      onClosed: (code) => {
        socket.current = null;
        const wasResuming = resumingRef.current;
        resumingRef.current = false;
        setResuming(false);
        writeToken(null); // this game is over for this tab: kicked, closed, replaced or lost
        // 1000 = the server ended it on purpose and the screen already says why.
        if (code === 1000) return;
        dispatch(wasResuming ? { type: "RESET" } : { type: "LEFT", reason: "DISCONNECTED" });
      },
    });
  }, []);

  // A refreshed tab resumes the game it was in.
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    resumingRef.current = true;
    setResuming(true);
    connect(token);
  }, [connect]);

  useEffect(() => () => socket.current?.close(), []);

  const send = useCallback((message: PlayerMessage) => socket.current?.send(message), []);

  // The clock only draws what the server said: one tick per second while a question is open.
  useEffect(() => {
    if (phase !== "question" && phase !== "answered") return;
    const timer = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Leaving the tab during a game is a signal for the host's report. Only a hint, never proof.
  useEffect(() => {
    if (phase === "join" || phase === "nickname" || phase === "lobby" || phase === "character") return;
    const onVisibility = () => {
      if (document.hidden) send({ type: "signal", kind: "TAB_BLUR" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase, send]);

  const submitPin = useCallback(async (pin: string) => {
    const clean = pin.replace(/\s/g, "");
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(clean)) {
      dispatch({ type: "REJECTED", error: "PIN_INVALID" });
      return;
    }
    try {
      await checkPin(clean);
      dispatch({ type: "PIN_ACCEPTED", pin: clean });
    } catch (error) {
      dispatch({ type: "REJECTED", error: toPlayerError(error instanceof ApiRequestError ? error.code : "NETWORK") });
    }
  }, []);

  const submitNickname = useCallback(
    async (nickname: string) => {
      try {
        // The server checks the name and gives the player a random character: they can change it in the lobby.
        const joined = await joinGame(state.pin, nickname);
        writeToken(joined.token);
        dispatch({ type: "JOINED", playerId: joined.player.id, nickname: joined.player.nickname, character: joined.player.character });
        connect(joined.token);
      } catch (error) {
        dispatch({ type: "REJECTED", error: toPlayerError(error instanceof ApiRequestError ? error.code : "NETWORK") });
      }
    },
    [state.pin, connect],
  );

  const answer = useCallback(
    (position: AnswerPosition) => {
      dispatch({ type: "ANSWER_SELECTED", position });
      send({ type: "answer", position });
    },
    [send],
  );

  const openCharacter = useCallback(() => dispatch({ type: "CHARACTER_OPENED" }), []);
  const closeCharacter = useCallback(() => dispatch({ type: "CHARACTER_CLOSED" }), []);

  /** The server checks what a client sends: only ids from the fixed lists are accepted. */
  const changeCharacter = useCallback(
    (character: Character) => {
      if (!isCharacter(character)) return;
      dispatch({ type: "CHARACTER_CHANGED", character });
      send({ type: "character.set", character });
    },
    [send],
  );

  /** Leave the game and start again from the PIN. */
  const reset = useCallback(() => {
    socket.current?.close();
    socket.current = null;
    writeToken(null);
    dispatch({ type: "RESET" });
  }, []);

  return { state, resuming, submitPin, submitNickname, answer, openCharacter, changeCharacter, closeCharacter, reset };
}
