import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Avatar, type AvatarId } from "../Avatar";
import { PlayerScreen } from "../PlayerScreen";

type LobbyScreenProps = {
  nickname: string;
  avatar: AvatarId;
};

export function LobbyScreen({ nickname, avatar }: LobbyScreenProps) {
  const t = useTranslations("player.lobby");

  return (
    <PlayerScreen topRight={<Badge>{t("badge")}</Badge>}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Avatar avatar={avatar} size="xl" />
        <h1 className="max-w-full text-h1 font-black [overflow-wrap:anywhere]">{nickname}</h1>
        <p className="text-body text-ink-muted">{t("hint")}</p>
      </div>
    </PlayerScreen>
  );
}
