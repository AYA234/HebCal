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

Work is tracked as GitHub issues on `AYA234/HebCal`, surfaced on the project board.
There is no task file in this repo — the issue is the task.

Role labels: `manager`, `developer`, `architect`
Status labels: `status:todo`, `status:in-progress`, `status:under-review`, `status:changes-requested`

`Done` is the issue closed as completed. Exactly one status label at a time.

**The issue holds the task: the ask, the acceptance criteria, the status label.
Nothing else.** Once work starts, the conversation moves to the pull request.

## Pull requests — where the work is discussed

Every issue is delivered as a PR into `main`. **All review conversation happens on the
PR, never on the issue**: hand-over notes, review findings, answers, test output,
approval. An issue comment during review is the wrong place and splits the record.

- The **developer** opens the PR when handing over. Title `[Developer][#<issue>] <what>`,
  body links the issue (`Closes #<issue>`) and states what changed, how it was verified,
  and what the manager should look at hardest.
- The **manager** reviews on the PR — a PR review with inline comments on the lines they
  refer to, numbered, each saying what is wrong and what is wanted instead. Then
  `REQUEST_CHANGES` or `APPROVE`.
- The **developer** answers every finding on its own PR thread — fixed (with the commit)
  or why it should stay — and pushes to the same branch.
- One PR open at a time per branch.

## Git

- Branches: `manager-work`, `developer-work`. Merge to `main` **fast-forward only**.
- Small commits. One logical change each. Minimal messages.
- Commit message: `[Manager|Developer][<issue>] message` — e.g. `[Developer][#4] render hebrew date in day cell`
- Rebase on `main` before handing work over, so the merge stays fast-forward.
- **Merging is the manager's, and it is done locally**, because GitHub's merge button
  cannot fast-forward — it either adds a merge commit or rewrites the commits:
  ```
  git checkout main && git pull origin main
  git merge --ff-only origin/<branch> && git push origin main
  ```
  Pushing those commits marks the PR merged. Then close the issue.

## Coding style

SOLID and KISS.

- Write only what the issue requires. No speculative options, no "might need later".
- Thin: the smallest code that does the job and stays readable.
- Open to change: name things for what they are, keep seams where change is likely.
- No dead code, no duplicated logic, no comments restating the code.
