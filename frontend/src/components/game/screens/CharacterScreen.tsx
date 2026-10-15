"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { CharacterBuilder } from "../CharacterBuilder";
import type { Character } from "../avatar/characters";
import { PlayerScreen } from "../PlayerScreen";

type CharacterScreenProps = {
  character: Character;
  onChange: (character: Character) => void;
  onDone: () => void;
  onLeave: () => void;
};

/** Opened from the lobby. Changes apply at once; «done» goes back to the lobby. */
export function CharacterScreen({ character, onChange, onDone, onLeave }: CharacterScreenProps) {
  const t = useTranslations("player.character");

  return (
    <PlayerScreen
      onLeave={onLeave}
      footer={
        <Button block size="lg" onClick={onDone}>
          {t("done")}
        </Button>
      }
    >
      <h1 className="text-display font-black [overflow-wrap:anywhere]">{t("title")}</h1>
      <CharacterBuilder value={character} onChange={onChange} />
    </PlayerScreen>
  );
}
