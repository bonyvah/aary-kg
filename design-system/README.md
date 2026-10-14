aary kg is a live quiz platform for classrooms and contests: players join a game with a PIN, hosts run it on a big screen, juries score contest entries. The look is loud, flat and chunky. The interface speaks Kyrgyz and Russian only.

## Content fundamentals

- Ship Kyrgyz (`ky`) and Russian (`ru`) only. No English strings in the UI. Every string goes through next-intl, with the same keys in both message files.
- Write short, direct, verb-first labels in sentence case: «Оюнга кошулуу», «Оюнду баштоо». The `overline` style is the only place for all caps.
- Pick one form of address per audience (сен / ты informal, сиз / вы formal) and keep it. Which one is still open: ask before writing copy.
- Expect text 20–30% longer than English. Let labels wrap, never fix a width, and test with the longest strings, for example «Ысык-Көл облусунун административдик борбору».
- Numbers, dates and plurals go through Intl and ICU plural rules, never string concatenation. Russian has three plural forms.
- No emoji, as icons or as decoration.
- The Kyrgyz letters ң ө ү (Ң Ө Ү) must render in Montserrat. If one falls back to another font, the `cyrillic-ext` subset is missing.
- Backend errors arrive as codes. The frontend turns them into a translated sentence that says what happened and what to do next.

## Visual foundations

- **Themes.** `light` is for staff screens (dashboard, quiz editor, contests, admin). `game` is for live game screens (join, lobby, question, leaderboard, podium, host view): set `data-theme="game"` on the screen root and every semantic token follows.
- **Color.** Paint pages with `surface`, panels with `surface-raised`, text with `ink` and `ink-muted`. The four answer colors (`tile-red`, `tile-blue`, `tile-yellow`, `tile-green`) belong to answer tiles and nothing else. `accent` yellow is for the start-game button, first place and the timer.
- **Flat and chunky.** Solid fills only. A pressable element has a hard bottom edge of 4px (6px on answer tiles) in its darker `-edge` color and drops onto it when pressed. No gradients, no blurred shadows, no glass, no neumorphism.
- **Answer tiles carry a shape.** Red triangle, blue diamond, yellow circle, green square. Color is never the only signal.
- **Status carries a word or an icon.** `success` and `danger` have almost the same lightness, so a green and a red alone are not enough: pair them with a word (Туура! / Туура эмес) or a check or cross mark. Message text uses `success-text` and `danger-text`.
- **Text on fills.** `on-primary` on `primary`, `on-accent` on `accent`, `on-danger`, `on-success`, `on-brand`, `on-warning` (dark, never white on orange), `on-tile` on three tiles and `on-tile-yellow` on the yellow one.
- **Type.** Montserrat in 500, 700 and 900, with the `latin`, `cyrillic` and `cyrillic-ext` subsets. Headings are 900. Use only the named styles: `display-xl`, `display`, `h1`, `h2`, `h3`, `body-lg`, `body`, `caption`, `overline`.
- **Spacing and radius.** Only `space-*` and `radius-*` tokens, on the 4px grid. Buttons, inputs, tiles and rows use `radius-md`; cards `radius-lg`; pills and avatars `radius-full`.
- **Targets.** At least 44px tall for anything tappable. Player screens are portrait and mobile-first. The host screen is landscape, projector-sized, with `display-xl` and `display`.
- **States.** Every interactive element has rest, hover (lifts 1px), pressed (drops 4px onto its edge), focus-visible (`focus-ring`, 3px, 2px offset) and disabled (`disabled` fill, `on-disabled` text, no edge).
- **Motion.** 150–250ms, ease-out, for press, reveal and score count-up. The timer fill moves linearly. Respect `prefers-reduced-motion`.
- **Original assets only.** Take the loud, playful feel from Kahoot. Never copy its logo, copy, illustrations or CSS.

## Iconography

- Phosphor icons in `bold` or `fill` weight. Never thin, light or regular outlines, and never lucide.
- The signature set is custom SVG, drawn with `currentColor` so tokens set the color: AnswerTriangle, AnswerDiamond, AnswerCircle, AnswerSquare, Crown, Podium, Trophy, Timer, Medal. The four answer shapes and the crown in these previews are simple stand-ins; the final crown, trophy and medal are drawn in Figma or Inkscape.
- Players are shown as shape characters, never photos: eight faces built from the four answer shapes in the answer colors (triangle, diamond, circle and square, each in two colors). Use the `Avatar` component. The character id (0–7) is assigned by the server or picked by the player on the join screen. Faces repeat within a game, so the nickname identifies the player. Staff lists use an initial in a circle instead.
- Icons that carry meaning get a translated `aria-label`. Decorative ones get `aria-hidden`.

## Where things live

- `tokens.json`: every token (colors per theme, type, spacing, radius, shadow). Read it before choosing any value.
- `components/bundle.css`: the styles of every component, as classes that read only tokens: `ak-btn`, `ak-input`, `ak-tile`, `ak-timer`, `ak-badge`, `ak-card`, `ak-row`, `ak-podium`, `ak-avatar`, `ak-chip`.
- `components/<Name>/preview.html`: the exact markup of each component in its states; copy it. `components/<Name>/README.md`: the rules for it. Components: Button, Input, AnswerTile, TimerBar, Badge, Card, LeaderboardRow, Podium, Avatar.
- `components/Avatar/avatars.svg`: the eight player characters as `<symbol id="av-tri-red">`, `av-tri-yellow`, `av-dia-blue`, `av-dia-green`, `av-cir-yellow`, `av-cir-red`, `av-sqr-green` and `av-sqr-blue`. Use these; never invent faces.
- The answer shapes (triangle, diamond, circle, square) and the check and cross marks are symbols in `components/AnswerTile/preview.html`. The crown is in `components/Podium/preview.html`. The timer has no icon: use `TimerBar`.
- There is no React bundle. Build screens as markup with these classes; the app ports them to React later.

## Logo

There is no logo yet. Set the name as "aary kg" in Montserrat 900, lowercase, in `ink`.
