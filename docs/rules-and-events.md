# Rules, Priorities & Event Bus

The heart of AIIFE's gameplay logic is an extensible, priority-banded event bus. It guarantees that game mechanics, preconditions, side effects, and custom author overrides execute in a predictable and deterministic sequence.

---

## 1. Why Priority Bands?

Traditional text adventure engines often divided execution into rigid phases: `before`, `on`, and `after`. In practice, as game complexity increases (e.g., handling complex puzzle interactions, NPC reactions, weapon checks, and container spills), three phases quickly break down:
- What if an author needs a guard to run *before* standard guards?
- What if a container spill needs to occur immediately after the mutation but *before* narrative side effects?
- What if a room or object needs to completely override an engine verb without monkey-patching?

AIIFE solves this with **Named Priority Bands**:

```ts
export const PRIORITY = {
  /** Validation & cancellation guards (lower runs first) */
  GUARD: 50,
  /** Core state mutations */
  MUTATION: 100,
  /** Post-mutation reactions (e.g. container spill) */
  POST_MUTATION: 110,
  /** Side-effects, sub-events, descriptions */
  EFFECT: 150,
  /** Daemon / tick-driven recurring effects */
  DAEMON: 200,
} as const;
```

---

## 2. Listener Execution Order

When an action is emitted on the bus via `bus.emit(event, world, state)`:

1. **Priority Ordering**: Registrations are grouped by numerical priority from lowest (e.g. 50) to highest (e.g. 200).
2. **Cancellation Check**: If at any point a listener calls `event.stop()`, event processing terminates immediately. No higher-priority listeners run, and the cancellation reason/feedback is returned.
3. **Scoped Preemption**:
   Within a single priority band, listeners registered with a specific `scopeId` (e.g. `bus.on("take", "heavy_rock", ...)`):
   - Run **before** global listeners registered at that same priority.
   - If a matching scoped listener exists in that priority band, **all global listeners at that priority band are skipped**.

```
Priority 50 (GUARD):
  ├─ Scoped listeners for target object/room (run first)
  │   └─ If matched, global GUARD listeners at priority 50 are skipped!
  └─ Global GUARD listeners (run only if no matching scoped listener)
Priority 100 (MUTATION):
  ├─ Scoped MUTATION listeners
  └─ Global MUTATION listeners (core action mutations)
Priority 110 (POST_MUTATION):
  └─ Reactions immediately following state update
Priority 150 (EFFECT):
  └─ Descriptions, room changes, secondary effects
Priority 200 (DAEMON):
  └─ Turn-end recurring handlers (tick)
```

---

## 3. Registering Listeners

### Global Listeners
Run for any event of that name regardless of the target:

```ts
bus.on("take", (event, state, world) => {
  // Global check: e.g., player encumbrance limit
  if (getInventory(state).length >= 10) {
    event.stop();
    return "Your load is too heavy. You can't carry anything more.";
  }
}, { priority: PRIORITY.GUARD });
```

### Scoped Listeners
Bound to a specific object ID or room ID:

```ts
bus.on("take", "cursed_skull", (event, state) => {
  // Only triggers when the target is "cursed_skull"
  event.stop();
  return "A chilling voice whispers: 'Leave me be...'";
}, { priority: PRIORITY.GUARD });
```

### One-Time Listeners (`once: true`)
Automatically unregister after firing:

```ts
bus.on("enter", "dark_tomb", (event, state) => {
  return "As you step inside, the stone entrance seals behind you with a thud!";
}, { once: true, priority: PRIORITY.EFFECT });
```

---

## 4. Mutating State vs Returning Feedback

A listener signature is:
```ts
(event: StoppableEvent<P>, state: GameState, world: World, bus?: EventBus) =>
  string | string[] | undefined | void
```

1. **State Mutation**: Modify `state` directly in place. The engine executes listeners inside Immer's `produce()`. If `event.stop()` is invoked or an error throws, the state transaction cleanly rolls back.
2. **Feedback Output**: Return a string or array of strings to display text to the player:
   ```ts
   bus.on("examine", "painting", () => {
     return "The stern portrait appears to be hinged on one side.";
   });
   ```

---

## 5. Core Built-In Actions

AIIFE includes standard interactive fiction actions registered at boot in `src/engine/rules/core-actions/`:

| Action | Description | Scope / Target Requirements |
| :--- | :--- | :--- |
| `go` | Move player in a compass direction | Compass direction (`north`, `south`, `up`, etc.) |
| `look` | Inspect current room and visible objects | Current room |
| `examine` | Detailed description of an object | Target must be in room or inventory |
| `take` | Move item from room or container to inventory | Target must be carriable and in scope |
| `drop` | Move item from inventory to current room | Target must be in inventory |
| `put` | Place item inside an open container or on ground | Both target and container must be in scope |
| `open` | Open a container or door | Target must be closed and unlocked |
| `close` | Close an open container or door | Target must be open |
| `unlock` | Unlock with key specified in `requires_instrument` | Key must be held in inventory |
| `lock` | Lock container or door | Key must be held in inventory |
| `inventory` | List items currently carried | Global |
| `use` | Generic object trigger or interaction | Target must be in scope |
| `move` | Push, pull, or nudge an object without taking it | Target must be in room |
| `attack` | Attack an actor with or without a weapon | Target must be in room |
| `talk` | Converse with an actor | Target must be in room |
| `save` | Save game state to storage slot | Slot name (optional) |
| `restore` | Load game state from storage slot | Slot name (optional) |
| `undo` | Revert to previous turn (up to 50 turns) | Global |
| `quit` | End the game session | Global |

---

## 6. Creating Custom Actions with `registerAction`

To add verbs not in the standard set (e.g., `pray`, `cast`, `rub`, `tie`), use `registerAction`:

```ts
import { z } from "zod";
import { registerAction, getTarget, isInInventory } from "../src/sdk";

registerAction(bus, registry, "rub", {
  schema: z.object({
    objects: z.array(z.string()).optional(),
  }),
  description: "rub(objects): Rub an object. objects: [target_id].",
  aliases: ["polish", "wipe"],
  hint: "Used for cleaning or activating magical artifacts.",
  handler: (event, state, world) => {
    const target = getTarget(event.params);
    if (target === "brass_lamp") {
      return "A puff of violet smoke erupts from the spout!";
    }
    return "Nothing happens.";
  },
});
```

Because `registerAction` registers the definition with both the **`EventBus`** (for runtime execution) and the **`ActionRegistry`** (for documentation and LLM system prompt injection), the LLM immediately recognizes commands like *"polish the brass lamp"* or *"rub lamp"* without any prompt alterations.
