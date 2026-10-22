import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Gear, Trash } from "@phosphor-icons/react/ssr";
import { Avatar } from "@/components/game/Avatar";
import { COLORS, FACES, SHAPES, type Character } from "@/components/game/avatar/characters";
import { AnswerTile } from "@/components/game/AnswerTile";
import { LeaderboardRow } from "@/components/game/LeaderboardRow";
import { LobbyChip } from "@/components/game/LobbyChip";
import { Podium } from "@/components/game/Podium";
import { CountdownRing } from "@/components/game/CountdownRing";
import { TimerBar } from "@/components/game/TimerBar";
import {
  AnswerCircle,
  AnswerDiamond,
  AnswerSquare,
  AnswerTriangle,
  Check,
  Cross,
  Crown,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { Table, Td, Th } from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import { mockLobbyPlayers, mockPlayers, mockStaff } from "@/mocks/design";
import type { StaffRole } from "@/types/game";
import { BuilderDemo } from "./BuilderDemo";
import { ModalDemo } from "./ModalDemo";
import { TabsDemo } from "./TabsDemo";
import { ToastDemo } from "./ToastDemo";

const CARD_COUNTS = [1, 2, 5, 21] as const;
const roleBadge: Record<StaffRole, "brand" | "neutral"> = { admin: "brand", jury: "brand", teacher: "neutral" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-overline font-bold uppercase text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

const wrap = "flex flex-wrap items-start gap-4";

export function Gallery({ idBase }: { idBase: string }) {
  const t = useTranslations("design");
  const tc = useTranslations("common");
  const topThree = mockPlayers.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <Section title={t("section.logo")}>
        <div className="flex flex-wrap items-center gap-6">
          <Logo />
          <LogoMark size={64} />
          <LogoMark size={96} />
        </div>
      </Section>

      <Section title={t("section.buttons")}>
        <Case label={t("state.rest")}>
          <div className={wrap}>
            <Button>{t("button.primary")}</Button>
            <Button variant="accent">{t("button.accent")}</Button>
            <Button variant="success">{t("button.success")}</Button>
            <Button variant="danger">{t("button.danger")}</Button>
            <Button variant="neutral">{t("button.neutral")}</Button>
            <Button variant="secondary">{t("button.secondary")}</Button>
          </div>
        </Case>
        <Case label={t("state.disabled")}>
          <div className={wrap}>
            <Button disabled>{t("button.primary")}</Button>
            <Button variant="accent" disabled>{t("button.accent")}</Button>
            <Button variant="danger" disabled>{t("button.danger")}</Button>
            <Button variant="neutral" disabled>{t("button.neutral")}</Button>
            <Button variant="secondary" disabled>{t("button.secondary")}</Button>
          </div>
        </Case>
        <Case label={t("state.sizes")}>
          <div className={wrap}>
            <Button size="lg">{t("button.large")}</Button>
            <Button size="lg" variant="accent">{t("button.accent")}</Button>
            <Button aria-label={t("button.neutral")} variant="neutral">
              <Icon icon={Gear} weight="bold" />
            </Button>
          </div>
        </Case>
        <Case label={t("state.long")}>
          <div className="max-w-[360px]">
            <Button block>{t("button.long")}</Button>
          </div>
        </Case>
      </Section>

      <Section title={t("section.inputs")}>
        <div className="grid max-w-[720px] gap-5 sm:grid-cols-2">
          <Case label={t("state.rest")}>
            <Input
              label={t("input.nicknameLabel")}
              placeholder={t("input.nicknamePlaceholder")}
              helper={t("input.nicknameHelp")}
            />
          </Case>
          <Case label={t("state.error")}>
            <Input label={t("input.nicknameLabel")} defaultValue="Айгерим" error={t("input.nicknameError")} />
          </Case>
          <Case label={t("state.disabled")}>
            <Input label={t("input.nicknameLabel")} placeholder={t("input.nicknamePlaceholder")} disabled />
          </Case>
          <Case label={t("state.long")}>
            <Input label={t("input.longLabel")} placeholder={t("input.nicknamePlaceholder")} />
          </Case>
          <Case label={t("state.pin")}>
            <Input label={t("input.pinLabel")} pin placeholder="123 456" />
          </Case>
        </div>
      </Section>

      <Section title={t("section.badges")}>
        <div className={wrap}>
          <Badge>{t("badge.admin")}</Badge>
          <Badge variant="neutral">{t("badge.user")}</Badge>
          <Badge>{t("badge.jury")}</Badge>
          <Badge variant="accent">{t("badge.live")}</Badge>
          <Badge variant="success">{t("badge.done")}</Badge>
          <Badge variant="danger">{t("badge.flag")}</Badge>
          <Badge variant="neutral">{t("badge.draft")}</Badge>
        </div>
      </Section>

      <Section title={t("section.cards")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {CARD_COUNTS.map((count) => (
            <Card key={count} className="flex flex-col gap-2">
              <h3 className="text-h3 font-bold">{count === 21 ? t("card.longTitle") : t("card.title")}</h3>
              <p className="text-body text-ink-muted">{t("card.count", { count })}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{t("badge.live")}</Badge>
                <Badge variant="neutral">{t("badge.draft")}</Badge>
              </div>
              <div className="mt-4">
                <Button>{t("card.open")}</Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t("section.tiles")}>
        <Case label={t("state.rest")}>
          <div className="grid max-w-[720px] grid-cols-2 gap-4 pb-2">
            <AnswerTile position={1}>{t("tile.a1")}</AnswerTile>
            <AnswerTile position={2}>{t("tile.a2")}</AnswerTile>
            <AnswerTile position={3}>{t("tile.a3")}</AnswerTile>
            <AnswerTile position={4}>{t("tile.a4")}</AnswerTile>
          </div>
        </Case>
        <Case label={`${t("state.long")} · ${t("state.locked")}`}>
          <div className="grid max-w-[720px] grid-cols-2 gap-4 pb-2">
            <AnswerTile position={1} pressed>{t("tile.long")}</AnswerTile>
            <AnswerTile position={2}>{t("tile.a2")}</AnswerTile>
            <AnswerTile position={3}>{t("tile.a3")}</AnswerTile>
            <AnswerTile position={4}>{t("tile.a4")}</AnswerTile>
          </div>
        </Case>
        <Case label={t("state.afterReveal")}>
          <div className="grid max-w-[720px] grid-cols-2 gap-4 pb-2">
            <AnswerTile position={1} dim>{t("tile.a1")}</AnswerTile>
            <AnswerTile position={2} result="ok" resultLabel={t("tile.correct")}>{t("tile.a2")}</AnswerTile>
            <AnswerTile position={3} result="no" resultLabel={t("tile.wrong")}>{t("tile.a3")}</AnswerTile>
            <AnswerTile position={4} dim>{t("tile.a4")}</AnswerTile>
          </div>
        </Case>
      </Section>

      <Section title={t("tile.shapesOnly")}>
        <div className="flex max-w-[360px] flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 pb-2">
            <AnswerTile shapeOnly position={1} aria-label={tc("answerShape.red")} />
            <AnswerTile shapeOnly position={2} aria-label={tc("answerShape.blue")} />
            <AnswerTile shapeOnly position={3} aria-label={tc("answerShape.yellow")} />
            <AnswerTile shapeOnly position={4} aria-label={tc("answerShape.green")} />
          </div>
          <Case label={t("state.locked")}>
            <div className="grid grid-cols-2 gap-4 pb-2">
              <AnswerTile shapeOnly pressed position={1} aria-label={tc("answerShape.red")} />
              <AnswerTile shapeOnly position={2} aria-label={tc("answerShape.blue")} />
            </div>
          </Case>
          <Case label={t("state.afterReveal")}>
            <div className="grid grid-cols-2 gap-4 pb-2">
              <AnswerTile shapeOnly dim position={1} aria-label={tc("answerShape.red")} />
              <AnswerTile shapeOnly position={2} result="ok" resultLabel={t("tile.correct")} aria-label={tc("answerShape.blue")} />
              <AnswerTile shapeOnly position={3} result="no" resultLabel={t("tile.wrong")} aria-label={tc("answerShape.yellow")} />
              <AnswerTile shapeOnly dim position={4} aria-label={tc("answerShape.green")} />
            </div>
          </Case>
        </div>
      </Section>

      <Section title={t("section.timer")}>
        <div className="flex max-w-[720px] flex-col gap-4">
          <TimerBar remaining={20} total={20} unit={t("timer.unit")} />
          <TimerBar remaining={8} total={20} unit={t("timer.unit")} />
          <Case label={t("state.urgent")}>
            <TimerBar remaining={3} total={20} unit={t("timer.unit")} />
          </Case>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <CountdownRing remaining={5} total={5} unit={t("timer.unit")} />
          <CountdownRing remaining={2} total={5} unit={t("timer.unit")} size="lg" />
        </div>
      </Section>

      <Section title={t("section.avatars")}>
        <Case label={t("characters.shapes")}>
          <div className={wrap}>
            {SHAPES.map((shape, index) => (
              <Avatar key={shape} size="xl" character={{ shape, color: COLORS[index], face: "smile" }} />
            ))}
          </div>
        </Case>
        <Case label={t("characters.colors")}>
          <div className={wrap}>
            {COLORS.map((color) => (
              <Avatar key={color} size="xl" character={{ shape: "circle", color, face: "grin" }} />
            ))}
          </div>
        </Case>
        <Case label={t("characters.faces")}>
          <div className={wrap}>
            {FACES.map((face, index) => (
              <Avatar key={face} size="xl" character={{ shape: "square", color: COLORS[index % COLORS.length], face }} />
            ))}
          </div>
        </Case>
        <Case label={t("characters.matrix")}>
          <div className="flex flex-col gap-2 overflow-x-auto pb-2">
            {SHAPES.map((shape, row) => (
              <div key={shape} className="flex gap-2">
                {FACES.map((face) => {
                  const character: Character = { shape, color: COLORS[row], face };
                  return <Avatar key={face} size="lg" character={character} />;
                })}
              </div>
            ))}
          </div>
        </Case>
        <div className={`${wrap} items-center`}>
          <Avatar character={{ shape: "heart", color: "pink", face: "shy" }} />
          <Avatar size="lg" character={{ shape: "star", color: "yellow", face: "happy" }} />
          <Avatar size="xl" character={{ shape: "pill", color: "teal", face: "cool" }} />
        </div>
      </Section>

      <Section title={t("section.builder")}>
        <BuilderDemo />
      </Section>

      <Section title={t("section.leaderboard")}>
        <div className="flex max-w-[480px] flex-col gap-2 pb-1">
          {mockPlayers.map((player, index) => (
            <LeaderboardRow
              key={player.id}
              rank={index + 1}
              nickname={player.nickname}
              score={player.score}
              character={player.character}
            />
          ))}
        </div>
      </Section>

      <Section title={t("section.podium")}>
        <h3 className="text-display font-black sm:text-display-xl">{t("podium.title")}</h3>
        <Podium players={topThree} crownLabel={t("podium.crown")} />
      </Section>

      <Section title={t("section.chips")}>
        <div className={wrap}>
          {mockLobbyPlayers.map((player) => (
            <LobbyChip key={player.id} nickname={player.nickname} character={player.character} />
          ))}
        </div>
      </Section>

      <Section title={t("section.tabs")}>
        <TabsDemo idBase={idBase} />
      </Section>

      <Section title={t("section.modal")}>
        <div>
          <ModalDemo />
        </div>
      </Section>

      <Section title={t("section.toast")}>
        <div className="flex max-w-[480px] flex-col gap-4 pb-1">
          <Toast>{t("toast.neutral")}</Toast>
          <Toast variant="success">{t("toast.success")}</Toast>
          <Toast variant="danger">{t("toast.danger")}</Toast>
        </div>
        <div>
          <ToastDemo />
        </div>
      </Section>

      <Section title={t("section.table")}>
        <Table>
          <thead>
            <tr>
              <Th>{t("table.name")}</Th>
              <Th>{t("table.role")}</Th>
              <Th>{t("table.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {mockStaff.map((user) => (
              <tr key={user.id}>
                <Td>
                  {user.name}
                </Td>
                <Td>
                  <Badge variant={roleBadge[user.role]}>{t(`badge.${user.role}`)}</Badge>
                </Td>
                <Td>
                  <Badge variant={user.active ? "accent" : "neutral"}>
                    {user.active ? t("badge.live") : t("badge.draft")}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title={t("section.empty")}>
        <EmptyState
          icon={Trash}
          title={t("empty.title")}
          description={t("empty.description")}
          action={<Button>{t("empty.action")}</Button>}
        />
      </Section>

      <Section title={t("section.loading")}>
        <div className="flex max-w-[480px] flex-col gap-4">
          <Spinner label={t("loading.label")} />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-[96px] w-full" />
        </div>
      </Section>

      <Section title={t("section.icons")}>
        <Case label={t("icons.custom")}>
          <div className={`${wrap} items-center`}>
            <AnswerTriangle />
            <AnswerDiamond />
            <AnswerCircle />
            <AnswerSquare />
            <Check />
            <Cross />
            <Crown className="text-accent" />
          </div>
          <p className="text-caption text-ink-muted">{t("icons.note")}</p>
        </Case>
        <Case label={t("icons.phosphor")}>
          <div className={`${wrap} items-center`}>
            <Icon icon={ArrowRight} weight="bold" size={32} />
            <Icon icon={ArrowRight} weight="fill" size={32} />
            <Icon icon={Gear} weight="bold" size={32} />
            <Icon icon={Gear} weight="fill" size={32} />
          </div>
        </Case>
      </Section>
    </div>
  );
}
