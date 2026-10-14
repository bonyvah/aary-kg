"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { SettingsModal } from "@/components/staff/SettingsModal";
import { useHostFlow } from "@/lib/hostFlow/useHostFlow";
import type { HostPhase } from "@/lib/hostFlow/reducer";
import { standingsAfter, MOCK_GAME_PIN } from "@/mocks/hostGame";
import { mockCurrentUser } from "@/mocks/staff";
import type { Quiz } from "@/types/quiz";
import { DemoBar } from "./DemoBar";
import { HostCountsScreen } from "./HostCountsScreen";
import { HostLeaderboardScreen } from "./HostLeaderboardScreen";
import { HostLobbyScreen } from "./HostLobbyScreen";
import { HostPodiumScreen } from "./HostPodiumScreen";
import { HostQuestionScreen } from "./HostQuestionScreen";
import { HostTopBar } from "./HostTopBar";

const DEMO_PHASES: readonly HostPhase[] = ["lobby", "question", "counts", "leaderboard", "podium"];

function HostRun({ quiz, onRestart }: { quiz: Quiz; onRestart: () => void }) {
  const t = useTranslations("host.live");
  const tDev = useTranslations("host.dev.phase");
  const flow = useHostFlow(quiz);
  const { state, question } = flow;
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const standings = standingsAfter(state.phase === "podium" ? flow.totalQuestions : state.round, flow.players);

  function screen() {
    switch (state.phase) {
      case "lobby":
        return <HostLobbyScreen pin={MOCK_GAME_PIN} players={flow.players} onStart={flow.start} />;
      case "question":
        return question ? (
          <HostQuestionScreen
            question={question}
            round={state.round}
            totalQuestions={flow.totalQuestions}
            secondsLeft={state.secondsLeft}
            answered={state.answered}
            total={state.total}
          />
        ) : null;
      case "counts":
        return question && state.counts ? (
          <HostCountsScreen question={question} round={state.round} totalQuestions={flow.totalQuestions} counts={state.counts} />
        ) : null;
      case "leaderboard":
        return <HostLeaderboardScreen round={state.round} totalQuestions={flow.totalQuestions} standings={standings} />;
      case "podium":
        return <HostPodiumScreen quizId={quiz.id} standings={standings} />;
    }
  }

  const showContinue = state.phase === "question" || state.phase === "counts" || state.phase === "leaderboard";

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBar
        phases={DEMO_PHASES.map((value) => ({ value, label: tDev(value) }))}
        phase={state.phase}
        paused={flow.paused}
        onPausedChange={flow.setPaused}
        onJump={flow.jumpTo}
        onRestart={onRestart}
      />
      <HostTopBar
        playerCount={flow.players.length}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((on) => !on)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-6">
        {screen()}
        {showContinue ? (
          <div className="flex justify-center pb-4">
            <Button variant="accent" size="lg" onClick={flow.advance}>
              {t("continue")}
            </Button>
          </div>
        ) : null}
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} name={mockCurrentUser.name} />
    </div>
  );
}

/** The host side of one game on mock data: lobby, questions, counts, leaderboard, podium. */
export function HostFlow({ quiz }: { quiz: Quiz }) {
  // A new key starts a fresh run: players join again from zero.
  const [run, setRun] = useState(0);
  return <HostRun key={run} quiz={quiz} onRestart={() => setRun((current) => current + 1)} />;
}
