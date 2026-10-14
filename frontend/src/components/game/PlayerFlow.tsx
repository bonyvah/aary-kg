"use client";

import { useTranslations } from "next-intl";
import { mockStandings, MOCK_TOTAL_QUESTIONS } from "@/mocks/playerFlow";
import { usePlayerFlow } from "@/lib/playerFlow/usePlayerFlow";
import { DemoBar } from "./DemoBar";
import type { GamePhase } from "@/types/game";
import { CharacterScreen } from "./screens/CharacterScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { NicknameScreen } from "./screens/NicknameScreen";
import { PodiumScreen } from "./screens/PodiumScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { ResultScreen } from "./screens/ResultScreen";

const DEMO_PHASES: readonly GamePhase[] = [
  "join",
  "nickname",
  "lobby",
  "character",
  "question",
  "answered",
  "result",
  "leaderboard",
  "podium",
];

/** The whole player flow on mock data. The screens only read `state` and call the actions. */
export function PlayerFlow() {
  const flow = usePlayerFlow();
  const tDev = useTranslations("player.dev.phase");
  const { state } = flow;
  const { phase, question, selected, reveal } = state;
  const round = question?.index ?? MOCK_TOTAL_QUESTIONS;
  const standings = () =>
    mockStandings(round, { nickname: state.nickname, character: state.character, score: state.score });

  function screen() {
    switch (phase) {
      case "join":
        return <JoinScreen error={state.error} onSubmit={flow.submitPin} />;
      case "nickname":
        return <NicknameScreen error={state.error} onSubmit={flow.submitNickname} />;
      case "lobby":
        return (
          <LobbyScreen
            nickname={state.nickname}
            character={state.character}
            onChangeCharacter={flow.openCharacter}
          />
        );
      case "character":
        return (
          <CharacterScreen
            character={state.character}
            onChange={flow.changeCharacter}
            onDone={flow.closeCharacter}
          />
        );
      case "question":
      case "answered":
        return question ? (
          <QuestionScreen
            question={question}
            secondsLeft={state.secondsLeft}
            selected={selected}
            onAnswer={flow.answer}
          />
        ) : null;
      case "result":
        return question && reveal ? (
          <ResultScreen question={question} selected={selected} reveal={reveal} />
        ) : null;
      case "leaderboard":
        return question ? <LeaderboardScreen question={question} standings={standings()} /> : null;
      case "podium":
        return <PodiumScreen standings={standings()} onExit={flow.reset} />;
    }
  }

  return (
    <>
      <DemoBar
        phases={DEMO_PHASES.map((value) => ({ value, label: tDev(value) }))}
        phase={phase}
        paused={flow.paused}
        onPausedChange={flow.setPaused}
        onJump={flow.jumpTo}
        onRestart={flow.reset}
      />
      {screen()}
    </>
  );
}
