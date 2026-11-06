---
name: spec-question
description: Record an open question about the recipe editor's specification instead of guessing. Use whenever the specification is ambiguous, contradictory or seems wrong, or a request changes specified behaviour.
argument-hint: "<question>"
---

# Record a specification question

Question: $ARGUMENTS

1. Read `docs/specification/10-open-questions.md` and check whether the question is already covered.
2. Find the affected requirement IDs in `docs/specification/`.
3. Append a row with the next free `QE-nn` to the open table: the question, the current default (what the editor
   does until it is answered) and the affected IDs.
4. If the user answers right away: move the row to the "Answered" table with the date and the answer, update the
   affected specification sections and acceptance criteria, then the code and tests.
5. A question about the recipe file format belongs to brewberrypi-app (its `13-open-questions.md`), not here.
