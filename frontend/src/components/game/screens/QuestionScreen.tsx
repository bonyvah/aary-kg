import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import type { PlayerQuestion } from "@/types/game";
import { AnswerTile, lastTileSpan, type AnswerPosition } from "../AnswerTile";
import { CountdownRing } from "../CountdownRing";
import { PlayerScreen } from "../PlayerScreen";
import { TimerBar } from "../TimerBar";
import { WaitingForOthers } from "./WaitingForOthers";

const POSITIONS = [
  { position: 1, shape: "red" },
  { position: 2, shape: "blue" },
  { position: 3, shape: "yellow" },
  { position: 4, shape: "green" },
] as const satisfies ReadonlyArray<{ position: AnswerPosition; shape: string }>;

type QuestionScreenProps = {
  question: PlayerQuestion;
  secondsLeft: number;
  /** While above 0 the question is being read: answers can't be given yet. */
  readingLeft: number;
  /** The locked answer. While it is set, the question and tiles give way to the waiting view. */
  selected: AnswerPosition | null;
  onAnswer: (position: AnswerPosition) => void;
  onLeave: () => void;
};

/**
 * Open question and, once an answer is locked, the waiting state. While it is being read: only the
 * question and the reading countdown. Shapes only, the answers are read on the host screen, unless the
 * host shows them on the players' screens too.
 */
export function QuestionScreen({ question, secondsLeft, readingLeft, selected, onAnswer, onLeave }: QuestionScreenProps) {
  const t = useTranslations("player.question");
  const tc = useTranslations("common");
  const locked = selected !== null;
  const texts = question.answers;
  const reading = readingLeft > 0;

  return (
    <PlayerScreen
      topLeft={<Badge>{t("counter", { current: question.index, total: question.total })}</Badge>}
      onLeave={onLeave}
    >
      {locked ? (
        <WaitingForOthers secondsLeft={secondsLeft} total={question.seconds} />
      ) : reading ? (
        <>
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{question.text}</h1>
          <CountdownRing
            key={question.index}
            className="m-auto"
            remaining={readingLeft}
            total={question.readSeconds}
            unit={t("unit")}
          />
        </>
      ) : (
        <>
          <TimerBar remaining={secondsLeft} total={question.seconds} unit={t("unit")} />
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{question.text}</h1>
          <div className={cx("mt-auto grid gap-4 pb-2", texts ? "grid-cols-1" : "grid-cols-2")}>
            {POSITIONS.filter(({ position }) => question.positions.includes(position)).map(({ position, shape }, index, shown) =>
              texts ? (
                <AnswerTile key={position} position={position} onClick={() => onAnswer(position)}>
                  {texts[position - 1]}
                </AnswerTile>
              ) : (
                <AnswerTile
                  key={position}
                  className={lastTileSpan(index, shown.length)}
                  shapeOnly
                  position={position}
                  aria-label={tc(`answerShape.${shape}`)}
                  onClick={() => onAnswer(position)}
                />
              ),
            )}
          </div>
        </>
      )}
    </PlayerScreen>
  );
}
