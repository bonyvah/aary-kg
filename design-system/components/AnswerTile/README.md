Big answer button in one of four colors, each paired with its own shape so color is never the only signal.

## Consumer provides
- A translated answer text as children. It can be long: the tile wraps and grows, never truncates.
- `position` 1–4, which sets color and shape: 1 red triangle, 2 blue diamond, 3 yellow circle, 4 green square.
- State: default, `aria-pressed="true"` once the player locked this answer, `dim` for answers that are not the right one after the reveal, and a result mark (`ok` check or `no` cross).

## Use
- Always a 2×2 grid on phones and projectors, 16px gap (`space-4`). Order never changes between players unless the host enabled shuffling.
- Text is `h2` size at weight 900. Yellow uses `on-tile-yellow`, the others `on-tile`.
- After the reveal: the right tile keeps its color with a check mark, a wrong chosen tile shows a cross, every other tile turns `disabled`.
- Height at least 96px, so it is easy to hit on a phone.

## Don't
- No tile without its shape, no recoloring the four colors for other uses.
- No opacity to dim a tile: use the `disabled` fill so text stays readable.
