<!-- Keep the three sections below; delete only what a section marks optional. -->

## Summary

<!-- What changed and why. Reference the issue if one exists. -->

## Verification

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Runtime-verified via the `verify` skill (required for anything touching
      sync, the monitor, or the controller; delete this line otherwise)

## Clinical sources

<!-- Invariant 7 (CLAUDE.md): clinical content — drug doses, treatment
     sequences, physiology numbers — must be verified against trusted
     published sources, cited here AND in docs/curriculum.md. Structural
     validity is not clinical review: a well-formed scenario can still
     misuse a field (e.g. an FiO2 value in the sevoflurane channel).
     Check exactly one box — an unchecked section blocks review. -->

- [ ] No clinical content changed
- [ ] Clinical content changed — sources cited below and in
      `docs/curriculum.md`:
