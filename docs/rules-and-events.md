# Event bus and rules reference

The `EventBus` class executes game actions through priority-ordered listener callbacks. Listeners validate preconditions, apply state mutations, trigger reactions, and emit feedback text.

For background on why AIIFE uses numerical priority bands instead of three-phase lifecycles, read [Rethinking the event bus](blog/02-rethinking-the-event-bus.md).

---

## Priority bands

The engine defines five named priority bands in `PRIORITY`:

```ts
export const PRIORITY = {
  /** Validation and cancellation guards (runs first) */
  GUARD: 50,
  /** Core state mutations */
  MUTATION: 100,
  /** Post-mutation reactions, such as container spills */
  POST_MUTATION: 110,
  /** Side effects, room descriptions, and sub-actions */
  EFFECT: 150,
  /** Daemon and turn-end recurring effects */
  DAEMON: 200,
} as const;
```

Lower numerical values execute before higher numerical values.

---

## Listener execution order

When `GameEngine` runs `bus.emit(event, world, state)`, execution follows these rules:

1. **Numeric priority.** The bus sorts listeners by priority from lowest to highest.
2. **Cancellation.** When any listener calls `event.stop()`, the bus halts processing. Higher-priority listeners do not run. The engine returns feedback collected before cancellation.
3. **Scoped preemption.** When a listener registers with a `scopeId` matching the target object or room:
   - Scoped listeners run before global listeners at that priority band.
   - If a matching scoped listener exists in that band, the bus skips all global listeners at that same priority band.

Execution order within a single event:

```
Priority 50 (GUARD):
  1. Scoped listeners for the target object or room.
  2. Global GUARD listeners (run only when no scoped listener matched).
Priority 100 (MUTATION):
  1. Scoped MUTATION listeners.
  2. Global MUTATION listeners (core engine actions).
Priority 110 (POST_MUTATION):
  1. Reactions that immediately follow state updates.
Priority 150 (EFFECT):
  1. Descriptions, movement feedback, and secondary effects.
Priority 200 (DAEMON):
  1. Turn-end recurring handlers emitted during the tick event.
```

---

## Listener registration

### Global listeners
Global listeners run for every event matching the action name:

```ts
bus.on("take", (event, state, world) => {
  if (getInventory(state).length >= 10) {
    event.stop();
    return "Your load is too heavy. You cannot carry anything more.";
  }
}, { priority: PRIORITY.GUARD });
```

### Scoped listeners
Scoped listeners bind to a specific object identifier or room identifier:

```ts
bus.on("take", "cursed_skull", (event, state) => {
  event.stop();
  return "A chilling voice whispers: 'Leave me be...'";
}, { priority: PRIORITY.GUARD });
```

### Single-invocation listeners
Listeners registered with `once: true` unregister after their first execution:

```ts
bus.on("enter", "dark_tomb", (event, state) => {
  return "As you step inside, the stone entrance seals behind you with a thud.";
}, { once: true, priority: PRIORITY.EFFECT });
```

---

## Listener handler contract

Listeners conform to this signature:

```ts
(event: StoppableEvent<P>, state: GameState, world: World, bus?: EventBus) =>
  string | string[] | undefined | void
```

### State mutation
Listeners modify `state` directly in place. The engine executes listeners inside Immer's `produce()`. If a listener calls `event.stop()` or throws an exception, the engine discards draft changes and leaves game state untouched.

### Feedback strings
Listeners return a string or an array of strings to display text to the player:

```ts
bus.on("examine", "painting", () => {
  return "The stern portrait appears to be hinged on one side.";
});
```

---

## Core built-in actions

AIIFE registers standard text adventure actions during engine initialization in `src/engine/rules/core-actions/`:

| Action | Description | Scope requirement |
| :--- | :--- | :--- |
| `go` | Move player in a compass direction | Compass direction (`north`, `south`, `up`, and others) |
| `look` | Inspect current room and visible items | Current room |
| `examine` | View detailed description of an object | Target must sit in current room or inventory |
| `take` | Move item from room or container to inventory | Target must be carriable and in scope |
| `drop` | Move item from inventory to current room | Target must sit in inventory |
| `put` | Place item inside an open container or on the ground | Both target and destination container must be in scope |
| `open` | Open a container or door | Target must be closed and unlocked |
| `close` | Close an open container or door | Target must be open |
| `unlock` | Unlock an object using a key | Key specified in `requires_instrument` must sit in inventory |
| `lock` | Lock container or door | Key specified in `requires_instrument` must sit in inventory |
| `inventory` | List items currently carried | Global |
| `use` | Generic object trigger or interaction | Target must sit in scope |
| `move` | Push or shift an object without taking it | Target must sit in current room |
| `attack` | Attack an actor with or without a weapon | Target must sit in current room |
| `talk` | Converse with an actor | Target must sit in current room |
| `save` | Save game state to storage slot | Slot name (optional) |
| `restore` | Load game state from storage slot | Slot name (optional) |
| `undo` | Revert to previous turn (up to 50 turns) | Global |
| `quit` | End the game session | Global |

---

## Custom actions

Register new verbs through `registerAction`:

```ts
import { z } from "zod";
import { registerAction, getTarget, isInInventory } from "aiife/sdk";

registerAction(bus, registry, "rub", {
  schema: z.object({
    objects: z.array(z.string()).optional(),
  }),
  description: "rub(objects): Rub an object. objects: [target_id].",
  aliases: ["polish", "wipe"],
  hint: "Used for cleaning or activating artifacts.",
  handler: (event, state, world) => {
    const target = getTarget(event.params);
    if (target === "brass_lamp") {
      return "A puff of violet smoke erupts from the spout.";
    }
    return "Nothing happens.";
  },
});
```

The function `registerAction` registers the definition with `EventBus` for execution and with `ActionRegistry` for prompt generation. The parser can then map synonyms like "polish the brass lamp" directly to the `rub` action without manual prompt updates.
