import type { KeyboardEvent } from "react";

const FIELDS = 'input[type="text"], input:not([type]), textarea';

/**
 * ArrowDown / ArrowUp in a text field moves to the next / previous text field of the form.
 * In a multi-line field the arrows keep moving the cursor until it is at the start or the end.
 * Put it on the form's `onKeyDown`; keys with Alt, Ctrl, Shift or Meta are left alone.
 */
export function moveBetweenFields(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (!target.matches(FIELDS)) return;
  const down = event.key === "ArrowDown";
  if (target instanceof HTMLTextAreaElement) {
    const { selectionStart, selectionEnd, value } = target;
    if (down ? selectionStart !== value.length || selectionEnd !== value.length : selectionStart !== 0 || selectionEnd !== 0) return;
  }
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FIELDS)).filter(
    (field) => !(field as HTMLInputElement).disabled && field.offsetParent !== null,
  );
  const next = fields[fields.indexOf(target) + (down ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
