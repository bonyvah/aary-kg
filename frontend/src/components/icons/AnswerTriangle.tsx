import { a11y, type IconProps } from "./types";

export function AnswerTriangle(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <path d="M16 4 28 26H4Z" fill="currentColor" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}
