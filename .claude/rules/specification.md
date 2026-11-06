---
paths:
  - "docs/specification/**"
---

# Editing the specification

- Keep `docs/specification/` about *what* the editor does; technology choices belong in the code and `README.md`.
- The recipe file format is the app's (brewberrypi-app `docs/specification/07-recipes.md`): cite it ("app `RCP-007`"),
  never redefine it here.
- Never change specified behaviour silently. A behaviour change needs a product-owner answer recorded in
  `docs/specification/10-open-questions.md` first; then update the affected sections and acceptance criteria.
- Requirement IDs are stable: never renumber or reuse an ID. New requirements take the next free number of their
  prefix (prefix table in `docs/specification/00-index.md`).
- Every acceptance criterion in `09-acceptance-criteria.md` gets a test whose name starts with its ID, or is marked
  *manual*; `tests/spec.test.ts` enforces it.
- User-visible texts quoted in the specification must match the editor verbatim.
