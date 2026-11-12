# Rethinking the event bus: why before, on, and after failed

When developers design an event system, game loop, or middleware pipeline, they often choose the three-phase pattern:

```
before -> on -> after
```

The pattern has decades of precedent in text adventures and web frameworks:
- `before`: Validation and precondition checks.
- `on`: Core state mutation.
- `after`: Side effects and secondary notifications.

As game complexity grew during our 110-room recreation of *Zork I*, the three-phase model broke down.

This article explains why fixed lifecycle phases failed and how named priority bands with scoped preemption solved the problem.

---

## The breakdown of fixed phases

### 1. Guards require internal ordering
Consider what happens when a player types `take dragon egg`:
1. Guard A (Engine default): Is the egg carriable?
2. Guard B (Game rule): Is the dragon awake in the room?
3. Guard C (Player state): Are the player's hands already full?

If the dragon is awake, the dragon's reaction should trigger first: *"The dragon roars and snaps at your arm."* The engine's generic encumbrance check should not say *"Your hands are too full to carry that."*

In a single `before` phase, all listeners run in registration order or arbitrarily. Handlers require fine-grained ordering within the guard phase itself.

### 2. Post-mutation reactions occur before side effects
Consider breaking a fragile glass bottle that contains a key.
When the player attacks or drops the bottle:
1. The bottle breaks and leaves state.
2. The key inside spills onto the floor of the room.
3. The engine prints a description.
4. A sound daemon or nearby actor reacts to the noise.

Where does the spill logic run?
- If it runs in `on`, it conflicts with the core action's mutation (`drop` sets `location = current_room`).
- If it runs in `after`, secondary listeners querying the room see the bottle gone but the key not yet on the floor.

The engine requires an intermediate stage: strictly after mutation, but strictly before side effects.

### 3. Scoped overrides conflict with global handlers
In text adventures, specific objects frequently override standard behavior:
- Typing `open chest` runs the core open logic.
- Typing `open iron door` on an electrified door should trigger the trap and cancel the normal opening behavior.

With standard publish-subscribe systems, both listeners run unless the author introduces manual flags like `event.isHandled = true`.

---

## The solution: named priority bands

Instead of three fixed phases, AIIFE uses a continuous pipeline governed by numerical priority bands:

```ts
export const PRIORITY = {
  /** Validation and cancellation guards (lower numbers run first) */
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

Every listener on `EventBus` has a numeric priority that defaults to `PRIORITY.MUTATION`. Lower numbers run first.

Any listener at any priority can call `event.stop()`:
```ts
bus.on("take", "heavy_anvil", (event) => {
  event.stop();
  return "The anvil is far too heavy to lift.";
}, { priority: PRIORITY.GUARD });
```

When a listener calls `event.stop()`:
- Event execution stops immediately.
- Later listeners in current and subsequent priority bands do not run.
- Draft mutations performed during the cancelled turn are discarded.

---

## Scoped listener preemption

The engine supports scoped preemption based on object identifiers:

```ts
// Global core open handler (registered at PRIORITY.MUTATION = 100)
bus.on("open", (event, state, world) => { ... }, { priority: PRIORITY.MUTATION });

// Scoped door trap handler (registered on "shock_door" at PRIORITY.MUTATION = 100)
bus.on("open", "shock_door", (event, state) => {
  event.stop();
  return "A high-voltage surge shocks you back.";
}, { priority: PRIORITY.MUTATION });
```

When an event targets `"shock_door"`:
1. At each priority band, the bus looks for listeners registered specifically for that `scopeId`.
2. If a matching scoped listener exists in that priority band, the bus skips all global listeners in that same priority band.

This design gives authors three benefits:
- Authors write object-specific behavior without modifying engine action source code.
- Core engine mechanics provide default fallbacks without referencing specific game objects.
- Object overrides run predictably without race conditions.

---

## Takeaways

1. **Fixed lifecycle phases do not scale.** As domain complexity grows, rigid lifecycle buckets subdivide into awkward sub-phases (`pre-`, `post-`, `around-`).
2. **Priority bands provide predictable ordering with room for extension.** Leaving numerical gaps (`50`, `100`, `110`, `150`, `200`) allows developers to insert one-off constraints (`PRIORITY.GUARD - 5`) without modifying existing listeners.
3. **Scoped preemption removes boilerplate conditional logic.** Scoping listeners to entity identifiers keeps code declarative and modular.
