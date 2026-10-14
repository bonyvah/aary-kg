Text input with a visible label, a white field and a 2px outline, in a regular size and a large centered PIN size.

## Consumer provides
- A translated label (`ak-label`) tied to the input with `for` and `id`. A placeholder never replaces the label.
- Optional helper text (`ak-help`) and error text (`ak-error`). Set `aria-invalid="true"` and `aria-describedby` on the input when there is an error.
- For the PIN: `inputmode="numeric"`, `autocomplete="off"`, and the `ak-input--pin` modifier.

## Use
- The field is white in both themes, so an input on the purple game screen looks the same as on a staff page.
- The outline meets 3:1 against its ground. Focus adds the `focus-ring` outline.
- Error text uses `danger-text` and says what to do: «Бул ат ээленген. Башка ат тандаңыз.»
- Height 48px; PIN 64px.

## Don't
- No floating labels, no placeholder-only inputs.
- No red outline as the only error signal: always show the message.
