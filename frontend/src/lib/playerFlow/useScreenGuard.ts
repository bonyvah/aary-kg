"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerMessage } from "@/lib/game/events";

type Signal = Extract<PlayerMessage, { type: "signal" }>["kind"];

/** Full screen can be asked for in this browser (an iPhone's Safari cannot: there nothing is enforced). */
const canFullscreen = () => typeof document !== "undefined" && document.fullscreenEnabled === true;

/** Asks for full screen. Only works inside a tap or a click. */
export function enterFullscreen() {
  if (!canFullscreen() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen().catch(() => {
    // Refused (no tap, or the browser said no): the gate stays and asks again.
  });
}

/**
 * Keeps an eye on the player's screen while a game is on. Leaving the tab, another window taking
 * focus and leaving full screen are each reported to the server as a signal for the host. Nothing
 * here proves anything: the browser can be told not to report. `blocked` is true while the player
 * is in a game but not in full screen, so the screen can ask them to go back.
 *
 * `watching`: the game is running (signals count). `inGame`: the player has joined (full screen is expected).
 */
export function useScreenGuard(
  inGame: boolean,
  watching: boolean,
  send: (message: PlayerMessage) => void,
): { blocked: boolean; enter: () => void } {
  // Starts true on the server and in browsers without full screen, so nothing blocks there.
  const [fullscreen, setFullscreen] = useState(true);

  useEffect(() => {
    if (!canFullscreen()) return;
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!watching) return;
    const report = (kind: Signal) => send({ type: "signal", kind });

    const onVisibility = () => {
      if (document.hidden) report("TAB_BLUR");
    };
    // The window lost focus but the tab is still shown: another window, split screen, an overlay.
    // Switching tabs fires this too, so it waits to see whether the tab was hidden.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      timer = setTimeout(() => {
        if (!document.hidden && !document.hasFocus()) report("WINDOW_BLUR");
      }, 100);
    };
    const onFullscreen = () => {
      if (document.fullscreenElement === null) report("FULLSCREEN_EXIT");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    if (canFullscreen()) document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [watching, send]);

  return { blocked: inGame && canFullscreen() && !fullscreen, enter: useCallback(enterFullscreen, []) };
}
