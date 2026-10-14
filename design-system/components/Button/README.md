Chunky action button with a hard bottom edge that lifts on hover and drops onto its edge when pressed.

## Consumer provides
- A translated label as children. Verb first, sentence case: «Оюнду баштоо», «Сактоо».
- `variant`: primary (default), accent, success, danger or neutral. `size`: default or lg. Optional `block` for full width, and `disabled`.
- An `aria-label` when a button holds only an icon.

## Use
- One primary or accent action per screen section. Accent (yellow) is for starting a game; danger only for destructive actions, with a confirm dialog.
- In the `game` theme the primary button is white with purple text; build it the same way, the tokens switch it.
- Let the label wrap. Never set a fixed width: Russian and Kyrgyz run 20–30% longer than English.
- Minimum height 44px; the large size is 56px.

## Don't
- No soft shadows, gradients or outlines instead of the edge.
- No white text on accent or warning fills: use `on-accent`.
- No disabled button without a reason shown nearby.
