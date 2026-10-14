import { a11y, type IconProps } from "./types";

export function AnswerSquare(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <rect x={5} y={5} width={22} height={22} rx={3} fill="currentColor" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}
