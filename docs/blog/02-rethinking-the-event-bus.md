# Rethinking the Event Bus: Why Before/On/After Failed and Priority Bands Won

*By the AIIFE Engineering Team*

---

If you have ever designed an event system, game loop, or HTTP middleware pipeline, you have probably reached for the classic three-phase pattern:

```
before -> on -> after
```

It is intuitive, clean, and has decades of precedent in tools like Inform 7 and standard web frameworks. When we began designing AIIFE, our specification proudly laid out:
- `before`: Validation and precondition checks.
- `on`: Core state mutation.
- `after`: Side effects and secondary notifications.

It looked elegant on paper. But as soon as we started implementing real, intricate adventure game puzzles—culminating in our 110-room recreation of *Zork I*—the three-phase model began to collapse under its own weight.

Here is why `before/on/after` broke down, and how migrating to **named priority bands with scoped preemption** gave us a clean, scalable rules engine.

---

## 1. The Breakdown of Rigid Phases

### Problem 1: Guards Need Priorities Among Themselves
Consider what happens when a player types `take dragon egg`:
1. Guard A (Engine default): Is the egg carriable?
2. Guard B (Game rule): Is the mama dragon awake in the room?
3. Guard C (Player state): Is the player's hands already full?

If the dragon is awake, you want the dragon's fiery reaction to trigger first: *"The dragon roars and snaps at your arm!"* You do **not** want the engine's generic encumbrance check to say: *"Your hands are too full to carry that."*

In a simple `before` phase, all listeners run in registration order or arbitrarily. You quickly find yourself wanting "before-the-before" or wishing you had fine-grained ordering within the guard phase.

### Problem 2: The "Immediate Post-Mutation" Dilemma
Consider breaking a fragile glass bottle containing a key.
When the player `drops` or `attacks` the bottle:
1. The bottle breaks and leaves state.
2. The key inside must spill out into the current room.
3. A description must be printed.
4. A sound daemon or nearby NPC might react to the noise.

Where does the spill logic run?
- If it runs in `on`, it conflicts with the core verb's own mutation (`drop` sets `location = current_room`).
- If it runs in `after`, other side effects (like NPC perception or descriptive text generation) may query the room and see the bottle gone but the key not yet placed on the floor!

You need a phase that is strictly *post-mutation* but strictly *pre-side-effects*.

### Problem 3: Scoped Overrides vs Global Handlers
In text adventures, individual objects constantly break the standard rules of physics.
- Normally, typing `open chest` runs the core open logic.
- But if you `open iron door`, and the door has an electric trap, you want the door's specific rule to run and completely preempt the normal `open` behavior.

With standard pub/sub, both the global listener and the scoped listener fire unless you introduce messy flags like `event.isHandled = true`.

---

## 2. The Solution: Named Priority Bands

Instead of three fixed phases, we introduced a single continuous pipeline governed by **Named Priority Bands**:

```ts
export const PRIORITY = {
  /** Validation & cancellation guards (lower numbers run first) */
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

Every listener on the `EventBus` has a numeric priority (defaulting to `PRIORITY.MUTATION`). Lower numbers run first.

Any listener at any priority can call `event.stop()`:
```ts
bus.on("take", "heavy_anvil", (event) => {
  event.stop();
  return "The anvil is far too heavy to lift.";
}, { priority: PRIORITY.GUARD });
```

When `event.stop()` is called:
- Event execution stops immediately.
- Later listeners in the current and subsequent bands are skipped.
- Any state mutations performed during the aborted turn are cleanly discarded.

---

## 3. Scoped Listener Preemption: Clean Object Overrides

The true breakthrough came with **Scoped Preemption**:

```ts
// Global core open handler (registered at PRIORITY.MUTATION = 100)
bus.on("open", (event, state, world) => { ... }, { priority: PRIORITY.MUTATION });

// Scoped door trap handler (registered on "shock_door" at PRIORITY.MUTATION = 100)
bus.on("open", "shock_door", (event, state) => {
  event.stop();
  return "A high-voltage surge shocks you back!";
}, { priority: PRIORITY.MUTATION });
```

When an event is dispatched with target `"shock_door"`:
1. At each priority band, the bus looks for listeners registered specifically for that `scopeId`.
2. **If a matching scoped listener exists in that priority band, all global listeners in that same priority band are skipped.**

This guarantees that:
- Game authors can write specific object behavior without needing to modify core action source code.
- Core engine mechanics provide reliable fallbacks without having to know about specific game objects.
- Object overrides behave predictably without race conditions.

---

## 4. Key Takeaways

1. **Discrete lifecycle phases are an illusion.** When software grows in domain complexity, rigid lifecycle buckets quickly subdivide into endless sub-phases (`pre-`, `post-`, `around-`).
2. **Priority bands give you predictable ordering with room to breathe.** By leaving numerical gaps (`50`, `100`, `110`, `150`, `200`), developers can slip in one-off ordering constraints (`PRIORITY.GUARD - 5`) without breaking other listeners.
3. **Scoped preemption eliminates boilerplate conditionals.** Scoping listeners to entity IDs keeps game code clean, modular, and declarative.
