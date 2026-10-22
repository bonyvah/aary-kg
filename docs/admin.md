# What an admin can and cannot do

Decided with the owner: an admin runs the platform, they don't use it.

| | admin | teacher | host of the game |
|---|---|---|---|
| Create, disable teachers, reset passwords | yes, role `teacher` only | no | no |
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

## Accounts: names, login, password

- A teacher has a **first name** and a **last name** (both required). Lists and messages show them as
  "first last". Accounts that existed before were split on the first space.
- Everybody (admins too) can change their own **login** and **password** from the name button in
  the top bar. Both ask for the current password again; wrong guesses are rate limited (8 per 15
  minutes, then `RATE_LIMITED`). Changing the password signs the teacher out everywhere else.
- A chosen password needs 8 to 128 characters, at least one letter (any alphabet) and one digit.
  No capital or special character is required.
- It must not contain the first name, last name or login (`PASSWORD_CONTAINS_NAME`,
  `PASSWORD_CONTAINS_LOGIN`). The comparison ignores alphabet and spelling: «Айжан», «Aizhan»,
  «ayzhan» and «AIJAN» are the same, and ө/ү/ң match o/u/n (or ö/ü/ng). Compound names are checked
  word by word; parts shorter than 3 letters are skipped. See `backend/app/password_policy.py`.
- The password an admin generates or resets is random and not checked against this rule, and teachers
  are not forced to change it. They can, in the settings.
