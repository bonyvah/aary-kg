Shape character that stands for a player: one of eight faces built from the four answer shapes, in the answer colors.

## Consumer provides
- `avatar`, an id from 0 to 7: 0 `tri-red`, 1 `tri-yellow`, 2 `dia-blue`, 3 `dia-green`, 4 `cir-yellow`, 5 `cir-red`, 6 `sqr-green`, 7 `sqr-blue`.
- A size: default 40px (rows, chips), `lg` 64px (podium), `xl` 96px (lobby wall and host screen).
- For staff lists (admins, users, juries) an initial in a circle instead: `ak-avatar--initial` with an optional color modifier.

## Use
- The server assigns the character when a player joins, or the player picks one of the eight on the join screen. Store only the id. Faces repeat in a game, so the nickname is what identifies a player.
- The character is decorative: render it with `aria-hidden` and keep the nickname next to it.
- Each character is drawn on a 48×48 grid with a 3px outline in the darker edge color of its body. Faces use `on-tile`, and `on-tile-yellow` on yellow bodies. The source is `components/Avatar/avatars.svg`. In the app, inline the eight SVGs in one React component; never load them as image files.
- In the lobby, a joined player is a `ak-chip`: avatar at 40px plus the nickname, on a white pill with a hard bottom edge.
- On the host's lobby wall, chips pop in with a 150–250ms scale. Respect `prefers-reduced-motion`.

## Don't
- No photos, uploads or camera input, ever.
- No recoloring a character, and no new characters until the Kyrgyz animal set is drawn.
- Don't use an avatar as the only way to tell two players apart.
