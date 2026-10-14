import { a11y, type IconProps } from "./types";

export function AnswerDiamond(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <path d="M16 3 29 16 16 29 3 16Z" fill="currentColor" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}
