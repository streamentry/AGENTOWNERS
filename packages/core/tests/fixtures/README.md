# Core integration fixtures

Fixtures are executable policy contracts, not sample data. Every adversarial
case in `adversarial-corpus.json` must include:

- a stable `id`;
- one sentence naming the invariant under attack;
- complete deterministic inputs;
- either an exact decision or an exact validation rejection;
- no network, clock, randomness, credentials, or machine-specific path.

## Adding a case

1. Identify a production branch whose mutation would violate the invariant.
2. Add the smallest fixture that reaches that branch.
3. Run the focused corpus and confirm it passes.
4. Temporarily apply the intended mutation.
5. Run the focused corpus and capture the expected failure.
6. Restore production code exactly and rerun the corpus.
7. Run `pnpm verify`.

Do not change production behavior merely to make a fixture pass. If a fixture
reveals a defect, open a separate bug issue and land that fix before expanding
the corpus.
