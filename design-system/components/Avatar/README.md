Character that stands for a player. It is built from three parts the player can change: a shape, a color and a facial expression.

## Consumer provides
- `character`: `{ shape, color, face }`, each an id from a fixed list. 8 shapes, 8 colors and 12 faces, so 768 combinations.
  - `shape`: `triangle`, `diamond`, `circle`, `square`, `hexagon`, `star`, `heart`, `pill`.
  - `color`: `red`, `blue`, `yellow`, `green`, `orange`, `purple`, `pink`, `teal` (tokens `avatar-*` and `avatar-*-edge`).
  - `face`: `smile`, `grin`, `wink`, `surprised`, `glasses`, `sleepy`, `cool`, `happy`, `tongue`, `angry`, `stars`, `shy`.
- A size: default 40px (rows, chips), `lg` 64px (podium), `xl` 96px (lobby wall, host screen and the builder preview).
- For staff lists (admins, users, juries) an initial in a circle instead: `ak-avatar--initial` with an optional color modifier.

## Use
- After the nickname the server (or the client until Phase 5) gives the player a random character. In the lobby the player can change shape, color and face, or shuffle, until the game starts. Store only the three ids per player, and validate them against the lists on the server.
- Faces repeat in a game, so the nickname is what identifies a player. Never use a character as the only way to tell two players apart.
- The character is decorative: render it with `aria-hidden` and keep the nickname next to it. In the builder every option has a translated name (`aria-label`) and a color is never the only signal.
- Each character is drawn on a 48×48 grid with a 3px outline in the darker `-edge` color of its body. Faces use `on-avatar`, or `on-avatar-dark` on the light bodies, with round eyes and 2.5px rounded strokes.
- In the lobby, a joined player is a `ak-chip`: avatar at 40px plus the nickname, on a white pill with a hard bottom edge.
- On the host's lobby wall, chips pop in with a 150–250ms scale. Respect `prefers-reduced-motion`.

## Don't
- No photos, uploads or camera input, ever.
- No free-form colors or user-drawn parts: only the listed ids.
- `avatars.svg` and `preview.html` here show the earlier fixed set of 8 characters and are kept only as history. The app builds characters from parts.
