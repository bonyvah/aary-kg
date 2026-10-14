import { a11y, type IconProps } from "./types";

export function Crown(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} {...a11y(props)}>
      <path d="M3 26 1 9 10 15 16 4 22 15 31 9 29 26Z" fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
