import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Avatar } from "../Avatar";
import type { Character } from "../avatar/characters";
import { PlayerScreen } from "../PlayerScreen";

type LobbyScreenProps = {
  nickname: string;
  character: Character;
  onChangeCharacter: () => void;
  onLeave: () => void;
};

export function LobbyScreen({ nickname, character, onChangeCharacter, onLeave }: LobbyScreenProps) {
  const t = useTranslations("player.lobby");
  const tc = useTranslations("player.character");

  return (
    <PlayerScreen onLeave={onLeave}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Avatar character={character} size="xl" />
        <h1 className="max-w-full text-h1 font-black [overflow-wrap:anywhere]">{nickname}</h1>
        <p className="text-body text-ink-muted">{t("hint")}</p>
        <Button variant="neutral" onClick={onChangeCharacter}>
          {tc("change")}
        </Button>
      </div>
    </PlayerScreen>
  );
}
