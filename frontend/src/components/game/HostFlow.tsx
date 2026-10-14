"use client";

import { useState } from "react";
import { SettingsModal } from "@/components/staff/SettingsModal";
import { useMockJoiners } from "@/lib/hostFlow/useMockJoiners";
import { mockCurrentUser } from "@/mocks/staff";
import { mockJoiners, MOCK_GAME_PIN } from "@/mocks/hostGame";
import type { Quiz } from "@/types/quiz";
import { HostLobbyScreen } from "./HostLobbyScreen";
import { HostTopBar } from "./HostTopBar";

/** The host side of one game on mock data. The lobby is here; the live screens come next. */
export function HostFlow({ quiz }: { quiz: Quiz }) {
  void quiz;
  const players = useMockJoiners(mockJoiners, 700);
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <HostTopBar
        playerCount={players.length}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((on) => !on)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-6">
        <HostLobbyScreen pin={MOCK_GAME_PIN} players={players} onStart={() => undefined} />
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} name={mockCurrentUser.name} />
    </div>
  );
}
