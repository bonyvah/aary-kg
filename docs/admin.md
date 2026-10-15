# What an admin can and cannot do

Decided with the owner: an admin runs the platform, they don't use it.

| | admin | user | host of the game |
|---|---|---|---|
| Create, disable users, reset passwords | yes, role `user` only | no | no |
| Other admins | listed, no actions (`CANNOT_MANAGE_ADMIN`) | n/a | n/a |
| The acting admin | not in their own list | n/a | n/a |
| Create quizzes, edit quiz questions and answers | no | yes (own) | yes |
| Host a game | no | yes (own quizzes) | yes |
| Create a contest | no | yes | n/a |
| See and manage every contest | yes | own only | n/a |
| See every finished game | yes (`GET /admin/games`) | own only | read-only report |
| Correct a finished game's data | yes | no | no, sees a note that an admin did |

Avatars exist only for players. Staff are shown by name.

## Correcting a finished game

`/admin/games/<id>` (API: `/admin/games/{id}/...`, see `backend/app/routers/admin_games.py`).
The quiz is never touched, only the data of that game:

- add or take away points (`adjustment`), or set the total;
- mark one answer right or wrong and change what it is worth (0 for wrong, 1 to 1000 for right);
- rename a player (same nickname rules as joining), remove a player, clear an anti-cheat flag;
- delete the whole game.

`score = sum(answer points) + adjustment`. After every change the ranking is recomputed the way the
live game ranks (score, then time of the correct answers, then nickname). Every change is appended
to the game's audit trail (`type: "admin.edit"`, who, when, what) and shown in the edit log; the
host's report shows how many corrections were made.
