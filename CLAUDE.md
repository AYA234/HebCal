# HebCal

Embed Hebrew dates **inside** the Ubuntu (GNOME Shell) calendar.

Not an app. Not a service. Not a panel of its own. The stock top-bar calendar keeps
being the calendar — it just also shows the Hebrew date, as if GNOME shipped it that
way. Existing solutions fail this bar: they open a separate window or add a second
indicator. If a user can tell our code is not part of GNOME, the feature is wrong.

## Team

| Role | Branch | Model | Owns |
|------|--------|-------|------|
| Manager | `manager-work` | opus5 | plan approval, issues, review, merges to `main` |
| Developer | `developer-work` | sonnet5 | the plan document, all product code |

The developer also wears the **architect** hat: planning issues carry the `architect`
label and are written by the developer.

## The board

Work is tracked **only** as GitHub issues on `AYA234/HebCal`, surfaced on the project
board. There is no task file in this repo — the issue is the task.

Role labels: `manager`, `developer`, `architect`
Status labels: `status:todo`, `status:in-progress`, `status:under-review`, `status:changes-requested`

`Done` is the issue closed as completed. Exactly one status label at a time.

Every board change is explained briefly in an issue comment — what changed and why.
Review comments are numbered, and each names the file, the line and the fix wanted.

## Git

- Branches: `manager-work`, `developer-work`. Both merge to `main` **fast-forward only**.
- Small commits. One logical change each. Minimal messages.
- Commit message: `[Manager|Developer][<issue>] message` — e.g. `[Developer][#4] render hebrew date in day cell`
- Rebase on `main` before handing work over, so the merge stays fast-forward.

## Coding style

SOLID and KISS.

- Write only what the issue requires. No speculative options, no "might need later".
- Thin: the smallest code that does the job and stays readable.
- Open to change: name things for what they are, keep seams where change is likely.
- No dead code, no duplicated logic, no comments restating the code.
