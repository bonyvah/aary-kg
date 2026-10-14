One leaderboard line with a rank, an avatar, the player's nickname and a score, on a white row with a hard bottom edge.

## Consumer provides
- `rank` (number), `nickname` (a string the player typed: truncates with an ellipsis, with the full name in a `title`), `score` (a number, formatted with Intl for the active locale).
- The player's avatar character id (see Avatar). It never changes during a game.

## Use
- Rows sit on the `game` theme: white rows (`field`) on the purple ground, `on-field` text, `space-2` gap between rows.
- First place switches to the `accent` fill with `on-accent` text.
- Show the top 5 on the host screen; on a player's phone show the player's own row, highlighted, plus the neighbors.
- Scores use tabular numerals so digits line up.

## Don't
- No more than one highlighted row.
- No profile photos: the avatar is one of the shape characters.
