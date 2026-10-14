Flat white panel with a 2px outline and a hard 4px bottom edge, used for quizzes, contests and settings groups.

## Consumer provides
- Content as children: a title (`h3`), a line of meta text (`body`, `ink-muted`), optional badges, and at most one primary action at the bottom.
- When the whole card is clickable, make the title the link and extend its hit area; do not nest buttons inside a clickable card.

## Use
- Padding `space-6`, radius `radius-lg`. Cards sit on `surface` and use `surface-raised`.
- Group cards in a grid with a `space-4` gap. A row of cards of the same kind has the same height.

## Don't
- No blurred shadow, no colored left border, no gradient header: this is a flat panel.
- No card inside a card.
