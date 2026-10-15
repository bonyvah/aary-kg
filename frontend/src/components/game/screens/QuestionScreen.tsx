import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { PlayerQuestion } from "@/types/game";
import { AnswerTile, type AnswerPosition } from "../AnswerTile";
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
  /** The locked answer. While it is set, the question and tiles give way to the waiting view. */
  selected: AnswerPosition | null;
  onAnswer: (position: AnswerPosition) => void;
  onLeave: () => void;
};

/** Open question and, once an answer is locked, the waiting state. Shapes only: answers are read on the host screen. */
export function QuestionScreen({ question, secondsLeft, selected, onAnswer, onLeave }: QuestionScreenProps) {
  const t = useTranslations("player.question");
  const tc = useTranslations("common");
  const locked = selected !== null;

  return (
    <PlayerScreen
      topLeft={<Badge>{t("counter", { current: question.index, total: question.total })}</Badge>}
      onLeave={onLeave}
    >
      {locked ? (
        <WaitingForOthers secondsLeft={secondsLeft} total={question.seconds} />
      ) : (
        <>
          <TimerBar remaining={secondsLeft} total={question.seconds} unit={t("unit")} />
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{question.text}</h1>
          <div className="mt-auto grid grid-cols-2 gap-4 pb-2">
            {POSITIONS.map(({ position, shape }) => (
              <AnswerTile
                key={position}
                shapeOnly
                position={position}
                aria-label={tc(`answerShape.${shape}`)}
                onClick={() => onAnswer(position)}
              />
            ))}
          </div>
        </>
      )}
    </PlayerScreen>
  );
}
