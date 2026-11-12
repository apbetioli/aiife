# History and undo

History and undo provides a 50-turn in-memory state transition stack that allows the player to rollback their last move or action step-by-step, returning to the prior physical state of the world.

## Sub-features

- `undo-single`: reverts the last state transition, restoring the previous room and object positions, and describing the room.
- `undo-multi`: sequentially rolls back multiple preceding turns.
- `undo-empty`: handles rollback requests when no previous history exists.

## How to get to it (user POV)

- Type `undo` at the prompt.

## Driving it with control-aiife

Preconditions:

- `control-aiife doctor` returns code 0.
- Starting game is `the-great-hall`.

- **Undo at game start.** Type `undo` on turn 0 before any moves. Run:
  `control-aiife drive --game the-great-hall --commands "undo" --output-dir artifacts/verify-aiife/undo-turn0`
  Observable result: Terminal outputs `Nothing to undo.` with event `⚡undo {}`.
- **Undo single room traversal.** Walk north to Library, then undo back to Great Hall. Run:
  `control-aiife drive --game the-great-hall --commands "north;undo;look" --output-dir artifacts/verify-aiife/undo-move`
  Observable result: Output shows movement to `The Library`, followed by `undo` which automatically re-executes `look` describing `The Great Hall`. Subsequent `look` confirms player is in `The Great Hall`.
- **Undo item manipulation.** Pick up an item, then undo to place it back. Run:
  `control-aiife drive --game the-great-hall --commands "take brass lantern;undo;inventory" --output-dir artifacts/verify-aiife/undo-item`
  Observable result: Inventory confirms player is empty-handed after undoing the take action.

## Gotchas

- Fast-path handles `undo` deterministically with 0 LLM latency.
- Undo history is capped at 50 turns (`MAX_UNDO_HISTORY = 50`). Transitions older than 50 turns are dropped from the stack.
- `undo` restores immutable state snapshots and re-triggers `look` to reorient the player, but does not rollback the current turn counter.
