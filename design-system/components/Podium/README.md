Three-step podium for the top three players, with the winner in the middle under a crown.

## Consumer provides
- The top three as `{ nickname, score, avatar }`, where `avatar` is the character id (64px, `ak-avatar--lg`). With fewer than three players, leave the missing steps out.
- A translated screen title above it («Жеңүүчү!» in `display-xl`) and a translated `aria-label` for the crown.

## Use
- Order left to right: 2nd, 1st, 3rd. Step heights are 112, 160 and 80px.
- Colors: 1st `accent` with `on-accent`, 2nd `tile-blue` with `on-tile`, 3rd `warning` with `on-warning` (dark text).
- Rank numbers are `display` size at weight 900. Nickname above the step, score under it.
- Reveal from 3rd to 1st over 150–250ms per step; with `prefers-reduced-motion`, show all at once.
- The crown here is a simple stand-in. The final crown is drawn in Figma or Inkscape and used through the icon wrapper.

## Don't
- No confetti or particle effects in the component. A celebration layer belongs to the screen.
- No fourth step: ranks 4 and below go in the leaderboard list.
