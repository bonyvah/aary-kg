"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";
import { usePlayerFlow } from "@/lib/playerFlow/usePlayerFlow";
import { enterFullscreen } from "@/lib/playerFlow/useScreenGuard";
import { FullscreenGate } from "./FullscreenGate";
import { CharacterScreen } from "./screens/CharacterScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { NicknameScreen } from "./screens/NicknameScreen";
import { PodiumScreen } from "./screens/PodiumScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { ResultScreen } from "./screens/ResultScreen";

/** The player's whole game. The screens only read `state` and call the actions. */
export function PlayerFlow() {
  const flow = usePlayerFlow();
  const t = useTranslations("common");
  const { state, resuming } = flow;
  const { phase, question, selected, reveal } = state;

  // The host's QR code and link carry the PIN: `/?pin=123456` fills it in.
  const [linkedPin, setLinkedPin] = useState("");
  useEffect(() => {
    const pin = new URLSearchParams(window.location.search).get("pin") ?? "";
    if (/^\d{6}$/.test(pin)) setLinkedPin(pin);
  }, []);

  // The tap that joins is also the one that asks for full screen: browsers only allow it inside a tap.
  function joinFullscreen(nickname: string) {
    enterFullscreen();
    return flow.submitNickname(nickname);
  }

  if (resuming) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label={t("loading")} />
      </div>
    );
  }

  function screen() {
    switch (phase) {
      case "join":
        return <JoinScreen key={linkedPin} initialPin={linkedPin} error={state.error} onSubmit={flow.submitPin} />;
      case "nickname":
        return <NicknameScreen error={state.error} onSubmit={joinFullscreen} />;
      case "lobby":
        return <LobbyScreen nickname={state.nickname} character={state.character} onChangeCharacter={flow.openCharacter} onLeave={flow.reset} />;
      case "character":
        return <CharacterScreen character={state.character} onChange={flow.changeCharacter} onDone={flow.closeCharacter} onLeave={flow.reset} />;
      case "question":
      case "answered":
        return question ? (
          <QuestionScreen question={question} secondsLeft={state.secondsLeft} selected={selected} onAnswer={flow.answer} onLeave={flow.reset} />
        ) : null;
      case "result":
        return question && reveal ? <ResultScreen question={question} selected={selected} reveal={reveal} onLeave={flow.reset} /> : null;
      case "leaderboard":
        return question ? <LeaderboardScreen question={question} standings={state.standings} onLeave={flow.reset} /> : null;
      case "podium":
        return <PodiumScreen standings={state.standings} onExit={flow.reset} />;
    }
  }

  return (
    <>
      {screen()}
      {flow.guard.blocked ? <FullscreenGate onEnter={flow.guard.enter} /> : null}
    </>
  );
}
