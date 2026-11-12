# AIIFE Verification Map

This directory is the maintained source for verifying the user-facing behavior of AIIFE (AI Interactive Fiction Engine). Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline Preconditions

- Node.js >= 20 must be installed.
- Repository dependencies installed via `npm install`.
- `.env` file present in the repo root with model provider configuration.
- Verification must be run through `.agents/skills/verify-aiife/bin/control-aiife` to allocate a pseudo-terminal (PTY) for Ink/React.
- Run `control-aiife doctor` before driving and require status `READY TO DRIVE`.
- Use disposable slot names (`verify-*`) for all save operations so user save files are never overwritten.

## Driving Conventions

- Start every recipe from the default clean state of the specified game (`the-great-hall` by default).
- Send commands using `.agents/skills/verify-aiife/bin/control-aiife drive`.
- Separate sequential commands with semicolons (e.g. `--commands "look;north;look"`).
- To test persistence, provide `--save-slot <slot-name>` to automatically extract and preserve `save-state.json`.
- Always run `control-aiife cleanup` after test runs to prune temporary `.save-*-verify-*.json` files.

## Proof and Evidence Reporting

- Proof artifacts are stored in `artifacts/verify-aiife/<run-id>/`.
- UI proof includes `transcript.txt` containing the user input (`› <cmd>`), engine bus events (`⚡<event>`), and game feedback prose.
- Bit-exact raw terminal stream is preserved in `transcript.raw.txt`.
- Persistence proof includes `save-state.json` capturing the serialized Immer state.
- Exit code and command duration are tracked in `session.json`.
- Proof artifacts survive cleanup.

## Feature Entry Contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order:

1. `Sub-features`: lists short IDs with one line for each behavior.
2. `How to get to it (user POV)`: lists every user entry point.
3. `Driving it with control-aiife`: starts with `Preconditions:` and uses labeled bullets pairing each user action with an exact command and observable result.
4. `Gotchas`: lists traps that can waste or invalidate a verification run.

## Features

- [Navigation and exploration](./navigation-and-exploration.md) covers cardinal movement, room discovery, looking around, and blocked exits.
- [Item and inventory](./item-and-inventory.md) covers examining objects, taking items into inventory, dropping items, and opening containers.
- [State persistence (save and restore)](./state-persistence-save-restore.md) covers saving game state to disk, slot sanitation, and restoring previous sessions.
- [History and undo](./history-and-undo.md) covers step-by-step turn rollback via the 50-turn undo stack and boundary handling.
- [Natural language and intent recognition](./natural-language-and-intent.md) covers complex or conversational commands mapped to engine actions via LLM tool calls.
