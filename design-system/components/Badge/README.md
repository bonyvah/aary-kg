Small pill that labels a role or a status in one or two words.

## Consumer provides
- A short translated label: «Админ», «Колдонуучу», «Жюри», «Жүрүп жатат», «Аяктады».
- `variant`: brand (default, roles), accent (live, highlight), success (done), danger (problem, cheating flag), neutral (draft, inactive).

## Use
- Roles: Админ and Жюри use brand, Колдонуучу uses neutral. Game status: Жүрүп жатат accent, Аяктады success.
- Every status is a word, never a bare colored dot.
- Text is `caption` at weight 700, padding `space-1` by `space-3`, fully rounded.

## Don't
- No more than two badges next to one item.
- No badge as a button: it is not interactive.
