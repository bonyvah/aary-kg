# What an admin can and cannot do

Decided with the owner: an admin runs the platform, they don't use it.

| | admin | teacher | host of the game |
|---|---|---|---|
| Create, disable teachers and students, reset passwords | yes, roles `teacher` and `student` only | no | no |
| Student groups: create, rename, delete an empty one, move a student | yes | no | n/a |
| Admins (others and the acting one) | not listed anywhere; refused with `CANNOT_MANAGE_ADMIN` | n/a | n/a |
| Create quizzes, edit quiz questions and answers | no | yes (own) | yes |
| Host a game | no | yes (any teacher's quiz, from the bazar too) | yes |
| Write exam sheets, run exams | no | yes (own) | n/a |
| See every exam | yes, read-only (`GET /admin/exam-sessions`) | own only | n/a |
| Take an exam attempt out of the count | yes (kept and shown, logged) | no | n/a |
| Create a contest | no | yes | n/a |
| See and manage every contest | yes | own only | n/a |
| See every finished game | yes (`GET /admin/games`) | own only | read-only report |
| Correct a finished game's data | yes | no | no, sees a note that an admin did |

Avatars exist only for players. Staff and students are shown by name.

Students can also be added from a list (Students tab): a `.docx`, `.xlsx` or `.txt` file (10 MB) or
pasted text goes to OpenAI, so **their names leave the server**, and comes back as a proposal of
first name, last name and login. Nothing is saved until the admin has corrected it and chosen the
group and the one password they all get (typed, never generated; it follows the rules below). Up to
200 students at a time, all added or none. Word's old `.doc` and Excel's old `.xls` are refused.
A login already in use gets a number (`bek.asanov2`), and its row says whose it is: it may be the
same student, already here.

The admin area has a tab each for teachers, students and groups. A student is always in exactly one
group (`GROUP_REQUIRED`); a group with students in it can't be deleted (`GROUP_NOT_EMPTY`).

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

- A teacher or student has a **first name** and a **last name** (both required). Lists and messages show them as
  "first last". Accounts that existed before were split on the first space.
- Everybody (admins too) can change their own **login** and **password** from the name button in
  the top bar. Both ask for the current password again; wrong guesses are rate limited (8 per 15
  minutes, then `RATE_LIMITED`). Changing the password signs the person out everywhere else.
- A chosen password needs 8 to 128 characters, at least one letter (any alphabet) and one digit.
  No capital or special character is required.
- It must not contain the first name, last name or login (`PASSWORD_CONTAINS_NAME`,
  `PASSWORD_CONTAINS_LOGIN`). The comparison ignores alphabet and spelling: «Айжан», «Aizhan»,
  «ayzhan» and «AIJAN» are the same, and ө/ү/ң match o/u/n (or ö/ü/ng). Compound names are checked
  word by word; parts shorter than 3 letters are skipped. See `backend/app/password_policy.py`.
- When creating an account or resetting its password, the admin types one or presses «generate»;
  left blank, the server generates one. A typed one follows the rules above (field `password`).
  A generated one is random (`xxxx-xxxx-xxxx`, always with a digit). The new password is shown once.
- A reset signs the person out everywhere. Nobody is forced to change a password they were given;
  they can, in the settings.
