"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { SettingsModal } from "@/components/staff/SettingsModal";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/useToast";
import { knownCode } from "@/lib/api/client";
import { useHostFlow } from "@/lib/hostFlow/useHostFlow";
import type { Quiz } from "@/types/quiz";
import { HostCountsScreen } from "./HostCountsScreen";
import { HostLeaderboardScreen } from "./HostLeaderboardScreen";
import { HostLobbyScreen } from "./HostLobbyScreen";
import { HostPodiumScreen } from "./HostPodiumScreen";
import { HostQuestionScreen } from "./HostQuestionScreen";
import { HostTopBar } from "./HostTopBar";

/** The host's side of one live game: lobby, questions, counts, leaderboard, podium. The server runs the game. */
export function HostFlow({ quiz }: { quiz: Quiz }) {
  const t = useTranslations("host.live");
  const tc = useTranslations("common");
  const flow = useHostFlow(quiz);
  const { state, refused, clearRefused } = flow;
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast, show } = useToast();

  // A command the server refused (nobody has joined yet, the game is not in that phase...).
  useEffect(() => {
    if (!refused) return;
    show("danger", tc(`apiError.${knownCode(refused)}`));
    clearRefused();
  }, [refused, show, clearRefused, tc]);

  if (flow.failed) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          icon={WarningCircle}
          title={tc(`apiError.${flow.failed}`)}
          action={<Button onClick={flow.retry}>{tc("retry")}</Button>}
        />
      </div>
    );
  }
  if (state.replaced) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          icon={WarningCircle}
          title={t("replaced.title")}
          description={t("replaced.description")}
          action={<ButtonLink href="/dashboard">{tc("toDashboard")}</ButtonLink>}
        />
      </div>
    );
  }
  if (!state.pin) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label={tc("loading")} />
      </div>
    );
  }

  const { question } = state;

  function screen() {
    switch (state.phase) {
      case "lobby":
        return (
          <HostLobbyScreen
            pin={state.pin}
            players={state.players}
            onKick={flow.kick}
            onStart={flow.start}
          />
        );
      case "question":
        return question ? (
          <HostQuestionScreen
            question={question}
            round={state.round}
            totalQuestions={state.totalQuestions}
            secondsLeft={state.secondsLeft}
            answered={state.answered}
            total={state.players.length}
          />
        ) : null;
      case "counts":
        return question && state.counts && state.correct ? (
          <HostCountsScreen
            question={question}
            correct={state.correct}
            round={state.round}
            totalQuestions={state.totalQuestions}
            counts={state.counts}
          />
        ) : null;
      case "leaderboard":
        return <HostLeaderboardScreen round={state.round} totalQuestions={state.totalQuestions} standings={state.standings} />;
      case "podium":
        return <HostPodiumScreen gameId={state.gameId} standings={state.standings} />;
    }
  }

  const showContinue = state.phase === "question" || state.phase === "counts" || state.phase === "leaderboard";

  return (
    <div className="flex min-h-dvh flex-col">
      <HostTopBar
        pin={state.pin}
        playerCount={state.players.length}
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
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {toast}
    </div>
  );
}
