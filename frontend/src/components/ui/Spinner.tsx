import { CircleNotch } from "@phosphor-icons/react/ssr";
import { cx } from "@/lib/cx";

type SpinnerProps = {
  /** Translated text for assistive tech, e.g. «Жүктөлүп жатат». */
  label: string;
  size?: number;
  className?: string;
};

export function Spinner({ label, size = 32, className }: SpinnerProps) {
  return (
    <span role="status" className={cx("inline-flex", className)}>
      <CircleNotch
        weight="bold"
        size={size}
        aria-hidden="true"
        className="animate-spin text-ink-muted motion-reduce:animate-none"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
