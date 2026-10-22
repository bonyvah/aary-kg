"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowsIn, ArrowsOut, Gear, SignOut, SpeakerHigh, SpeakerSlash, User } from "@phosphor-icons/react/ssr";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Logo } from "@/components/ui/Logo";
import { JoinInfo } from "./JoinInfo";

type HostTopBarProps = {
  pin: string;
  playerCount: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  /** Quit the game without saving it. Not offered once it is over (it is saved by then). */
  onQuit?: () => void;
};

/** Top bar of every host screen: the PIN and QR button on the left, the logo in the middle, player count, sound, settings and fullscreen on the right. */
export function HostTopBar({ pin, playerCount, soundOn, onToggleSound, onOpenSettings, onQuit }: HostTopBarProps) {
  const t = useTranslations("host.bar");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  return (
    <header className="bg-surface-raised">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2">
        <JoinInfo pin={pin} />
        <Logo />
        <div className="flex items-center justify-end gap-1">
          <span
            role="img"
            aria-label={t("players", { count: playerCount })}
            className="flex items-center gap-1 px-2 text-body-lg font-bold tabular-nums"
          >
            <Icon icon={User} weight="bold" />
            {playerCount}
          </span>
          <IconButton label={soundOn ? t("soundMute") : t("soundUnmute")} aria-pressed={!soundOn} onClick={onToggleSound}>
            <Icon icon={soundOn ? SpeakerHigh : SpeakerSlash} weight="bold" />
          </IconButton>
          <IconButton label={t("settings")} onClick={onOpenSettings}>
            <Icon icon={Gear} weight="bold" />
          </IconButton>
          <IconButton label={fullscreen ? t("exitFullscreen") : t("fullscreen")} onClick={toggleFullscreen}>
            <Icon icon={fullscreen ? ArrowsIn : ArrowsOut} weight="bold" />
          </IconButton>
          {onQuit ? (
            <IconButton label={t("quit")} aria-haspopup="dialog" onClick={onQuit}>
              <Icon icon={SignOut} weight="bold" />
            </IconButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
