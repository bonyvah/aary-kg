"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { formatPin, JOIN_HOST, joinUrl } from "@/lib/joinLink";
import type { Player } from "@/types/game";
import { LobbyChip } from "./LobbyChip";

type HostLobbyScreenProps = {
  pin: string;
  players: readonly Player[];
  /** Removes a player from the lobby. */
  onKick: (playerId: string) => void;
  onStart: () => void;
};

const plate = "rounded-lg bg-field text-on-field shadow-[0_4px_0_0_var(--border)]";

/** What the projector shows before the game: how to join, who has joined, and the start button. */
export function HostLobbyScreen({ pin, players, onKick, onStart }: HostLobbyScreenProps) {
  const t = useTranslations("host.lobby");
  // The QR code opens the site the host screen is on.
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <div className="flex flex-wrap items-stretch justify-center gap-4">
        <div className={`${plate} flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-8 py-6`}>
          <p className="max-w-[220px] text-body-lg font-bold">{t("joinAt", { site: JOIN_HOST })}</p>
          <p className="text-display-xl font-black tabular-nums">{formatPin(pin)}</p>
        </div>
        <div role="img" aria-label={t("qrLabel")} className={`${plate} grid place-items-center p-4`}>
          <QRCodeSVG value={joinUrl(pin, origin)} size={112} marginSize={0} bgColor="transparent" fgColor="currentColor" aria-hidden="true" />
        </div>
      </div>

      <ul aria-label={t("players")} className="flex max-w-[1000px] flex-wrap justify-center gap-3">
        {players.map((player) => (
          <li key={player.id}>
            {/* Clicking a player removes them; the name is struck through on hover as the warning. */}
            <button
              type="button"
              aria-label={t("kick", { name: player.nickname })}
              onClick={() => onKick(player.id)}
              className={
                "group cursor-pointer rounded-full " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              }
            >
              <LobbyChip nickname={player.nickname} character={player.character} animate />
            </button>
          </li>
        ))}
      </ul>
      {players.length === 0 ? <p className="text-body-lg text-ink-muted">{t("waiting")}</p> : null}

      <div className="mt-auto flex flex-col items-center gap-4 pb-4">
        <Button variant="accent" size="lg" disabled={players.length === 0} onClick={onStart}>
          {t("start")}
        </Button>
      </div>
    </div>
  );
}
