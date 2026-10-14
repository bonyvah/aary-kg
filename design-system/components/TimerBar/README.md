Countdown bar with a yellow fill that shrinks linearly and a large seconds number, turning red for the last seconds.

## Consumer provides
- Remaining seconds and total seconds. The fill width is `--pct` (remaining ÷ total), set from the server's clock, never from the client's.
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`, and a translated unit («сек»).
- The `ak-timer--urgent` modifier for the last 5 seconds.

## Use
- Render it on the `game` theme: the yellow fill and the dark track are built for the purple ground.
- The number is `h2` size at weight 900 with tabular numerals so it does not jitter.
- The fill moves linearly. With `prefers-reduced-motion`, show only the number.

## Don't
- No color change without the number: red alone is not a signal.
- No client-side timer deciding when answers close. It only draws what the server says.
