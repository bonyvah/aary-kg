# What an admin and the superadmin can and cannot do

Decided with the owner: admins and the superadmin run the platform, they don't use it. An admin looks
after teachers, students and groups; the superadmin looks after the admins and is the only one who
corrects games, exams and contests (issue #96). Each sees the other's side read-only.

| | superadmin | admin | teacher | host of the game |
|---|---|---|---|---|
| Create, disable admins, reset their passwords | yes, role `admin` only | no, `CANNOT_MANAGE_ADMIN` | no | no |
| Create, disable teachers and students, reset passwords | no, sees them read-only | yes, roles `teacher` and `student` only | no | no |
| Student groups: create, rename, delete an empty one, move a student | no, sees them read-only | yes | no | n/a |
| Superadmins (others and the acting one) | not listed anywhere; refused with `CANNOT_MANAGE_ADMIN` | the same | n/a | n/a |
| Create quizzes, edit quiz questions and answers | no | no | yes (own) | yes |
| Host a game | no | no | yes (any teacher's quiz, from the bazar too) | yes |
| Write exam sheets, run exams | no | no | yes (own) | n/a |
| See every exam | yes, read-only (`GET /admin/exam-sessions`) | yes, read-only | own only | n/a |
| Write survey sheets, start and close surveys | no, sees surveys and results read-only | yes (all admins share them) | no | n/a |
| Take an exam attempt out of the count | yes (kept and shown, logged) | no | no | n/a |
| Create a contest | no | no | yes | n/a |
| See every contest | yes | yes, read-only | own only | n/a |
| Open and close any contest | yes | no | own only | n/a |
| See every finished game | yes (`GET /admin/games`) | yes, read-only | own only | read-only report |
| Correct a finished game's data | yes | no | no | no, sees a note that it was corrected |

The superadmin comes from the command line: `python -m app.cli create-superadmin` (`make superadmin`).

Avatars exist only for players. Staff and students are shown by name.

Students can also be added from a list (Students tab): a `.docx`, `.xlsx` or `.txt` file (10 MB) or
pasted text goes to OpenAI, so **their names leave the server**, and comes back as a proposal of
first name, last name and login. Nothing is saved until the admin has corrected it and chosen the
group and the one password they all get (typed, never generated; it follows the rules below). Up to
200 students at a time, all added or none. Word's old `.doc` and Excel's old `.xls` are refused.
A login already in use gets a number (`bek.asanov2`), and its row says whose it is: it may be the
same student, already here.

The admin area has a tab each for teachers, students and groups; the superadmin also gets an admins tab. A student is always in exactly one
group (`GROUP_REQUIRED`); a group with students in it can't be deleted (`GROUP_NOT_EMPTY`).

## Correcting a finished game

`/admin/games/<id>` (API: `/admin/games/{id}/...`, see `backend/app/routers/admin_games.py`).
Only the superadmin corrects; an admin opens the same page read-only.
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

## Anonymous surveys

`/admin` → Surveys tab (API: `/admin/survey-sheets`, `/admin/surveys`, students `/student/surveys`).

- A sheet's question is single choice, multiple select or open-ended, mandatory or optional. Choices: 2 to 30.
  A multiple select takes any number, at least N, at most N or exactly N. An open answer is limited in
  words (1 to 100), counted as 6 characters each, never over 650 characters.
- A survey copies the sheet and lists the active students of the chosen groups when it starts. It is
  open until an admin closes it. A student answers once, all at once (`SURVEY_ALREADY_ANSWERED`).
- Nothing ties an answer to a student: `survey_respondents` says who answered, `survey_responses` what,
  with no link and no time on either. The results show only counts and the open texts, shuffled.
  With very few respondents, answers can still be guessed from the counts.
