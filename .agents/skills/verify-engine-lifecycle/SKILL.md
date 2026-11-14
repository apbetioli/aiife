---
name: verify-engine-lifecycle
description: "Formally verify the AIIFE GameEngine turn lifecycle, undo stack invertibility, action atomicity, and save/restore timeline invariants using TLA+ and /statechart. Use when modifying src/engine/game-engine.ts, save/restore persistence, undo mechanics, or event bus action lifecycles."
---

# Verify Engine Lifecycle

This skill formally verifies the state invariants of `GameEngine`: the interaction between turn execution, action failure rollback, bounded undo history, and save/restore persistence.

## Verified Code & Coverage Record

- **Coverage**:
  - `src/engine/game-engine.ts`: `runAction()`, `undo()`, `save()`, `restore()`, `pushHistory()`, `isGameOver()`
  - `src/engine/save.ts`: `save()`, `load()`, `sanitizeSlot()`
  - `src/engine/rules/core-actions/system/tick.ts`: `tick` action handler
  - `src/engine/rules/executor.ts`: `executeUntrustedAction()`
- **Sync commit**: `9116376bf2933520c30ad7c0f96fc2df90c81cb8`

To check if a change touches the verified code since the sync commit, run:

```sh
git diff 9116376bf2933520c30ad7c0f96fc2df90c81cb8 -- \
  src/engine/game-engine.ts \
  src/engine/save.ts \
  src/engine/rules/core-actions/system/tick.ts \
  src/engine/rules/executor.ts
```

If any covered file has changed, re-run this verification and confirm whether the TLA+ specification accurately describes the code at the new commit before updating the sync commit.

---

## Run

Run the single verification command:

```sh
./.agents/skills/verify-engine-lifecycle/run-check.sh
```

This runs two complementary verifications:
1. **TLC Model Checker** via the pstack `/statechart` skill over the TLA+ specification in `.agents/skills/verify-engine-lifecycle/EngineLifecycle.tla`. It outputs `report.md` and Mermaid chart `chart.mmd` into `artifacts/verify-engine-lifecycle`. Read every model checking result with the `/statechart` skill.
2. **TypeScript Live Reproduction Test** (`repro-findings.ts`), which runs the counterexample action sequences directly against `GameEngine` to confirm whether findings occur in real code.

---

## Verified Properties

| Property | Plain-English Statement | Status on Commit `9116376` | Harm If Broken |
| :--- | :--- | :--- | :--- |
| `HistoryBounded` | In-memory history length never exceeds `MAX_UNDO_HISTORY` (50). | **Holds** | Unbounded memory consumption during long sessions. |
| `StoppedActionPurity` | An action that stops or is rejected must not leave persistent un-undoable mutations in engine state. | **Fails (Finding 1)** | Failed commands leave corrupt state that cannot be undone. |
| `GameOverTerminal` | Once `quit` is executed (`isGameOver() === true`), normal actions cannot execute without restart. | **Fails (Finding 2)** | Player continues moving and manipulating world in a zombie state after game ended. |
| `UndoNeverAdvancesTurn` | Calling `undo` must never jump the player forward to a higher move count or an alternate future. | **Fails (Finding 3)** | Undoing after restoring a save teleports player into an abandoned future timeline. |

---

## Findings & Counterexamples

### Finding 1: Partial Mutation Leakage on Stopped Actions (`StoppedActionPurity`)
- **Code reference**: `src/engine/game-engine.ts` lines 161–167:
  ```ts
  const prevState = this.state;
  const result = executeUntrustedAction(this.bus, this.registry, this.world, this.state, action, params);
  this.state = result.state; // Mutation applied unconditionally!

  if (result.stopped) {
    return result.feedback.length > 0 ? result.feedback.join("\n") : ...; // Early return skips pushHistory!
  }
  this.pushHistory(prevState);
  ```
- **TLC Counterexample Path (1 step)**:
  1. Turn 0: Engine starts in `room_a` (`moves = 0`).
  2. Player runs an action whose guard or listener mutates state and calls `event.stop()`.
  3. `this.state` retains the dirty mutation, but `pushHistory(prevState)` was skipped.
  4. Player calls `undo`: Engine reports `"Nothing to undo."`, leaving the game permanently tainted.
- **Harm**: The player is told the action failed, but the world state was partially altered and cannot be reverted.

### Finding 2: Zombie Actions After Game Over (`GameOverTerminal`)
- **Code reference**: `src/engine/game-engine.ts` line 115:
  `GameEngine.runAction()` never checks `this.isGameOver()`.
- **TLC Counterexample Path (2 steps)**:
  1. Player runs `quit`: `setPlayerState(state, "quit", true)` runs; `isGameOver()` is now `true`.
  2. Player runs `go south` or `save slot`: Action executes normally, moving rooms and advancing turns despite the game having terminated.
- **Harm**: Broken session semantics; terminal games continue executing commands as if active.

### Finding 3: Undo Advances Moves into Abandoned Future (`UndoNeverAdvancesTurn`)
- **Code reference**: `src/engine/game-engine.ts` line 195:
  ```ts
  restore(file: unknown): string {
    const restored = load(file);
    ...
    this.pushHistory(this.state); // Pushes abandoned future onto un-cleared history!
    this.state = restored;
  ```
- **TLC Counterexample Path (4 steps)**:
  1. Save at `room_a` (`moves = 0`).
  2. Move south to `room_b` (`moves = 1`).
  3. Restore save: Engine loads `room_a` (`moves = 0`), but pushes `room_b (m=1)` onto `this.history`.
  4. Player calls `undo`: Engine pops `room_b`! The player is teleported forward in time to `room_b` with `moves = 1`.
- **Harm**: Calling `undo` after restore jumps across parallel universes, splicing discarded future state into the restored game.

---

## Distinguishing Real Bugs from Modeling Errors

When TLC reports an invariant break:
1. Run `node --import tsx .agents/skills/verify-engine-lifecycle/repro-findings.ts`.
2. If the TypeScript test reproduces the exact sequence against `GameEngine` and asserts the failure, it is a **confirmed engine bug**.
3. If the TypeScript test fails to reproduce (i.e. the engine actually prevented it), the TLA+ specification is over-approximate and should be refined in `EngineLifecycle.tla`.

---

## Updating the Verification

When product code in `src/engine/game-engine.ts` is intentionally changed (for example, resetting history on restore or rolling back stopped actions):
1. Update `EngineLifecycle.tla` to mirror the new code logic.
2. Run `./.agents/skills/verify-engine-lifecycle/run-check.sh`.
3. Check the Mermaid chart and state transitions using `/statechart`.
4. Update `repro-findings.ts` to assert that the bug no longer occurs.
5. Update the sync commit in this file with `git rev-parse HEAD`.
