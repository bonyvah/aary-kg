import { a11y, type IconProps } from "./types";

export function AnswerCircle(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <circle cx={16} cy={16} r={12} fill="currentColor" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}
