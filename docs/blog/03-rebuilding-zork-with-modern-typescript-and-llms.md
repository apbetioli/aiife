# Rebuilding Zork I with modern TypeScript, priority events, and LLMs

In 1977, Tim Anderson, Marc Blank, Bruce Daniels, and Dave Lebling created *Zork* at MIT. Over the next decade, Infocom developed it into the definitive benchmark of interactive fiction. *Zork I: The Great Underground Empire* featured over 100 rooms, interconnected puzzles, dynamic inventory limits, a wandering thief, a combat system, and a flexible text parser.

When designing AIIFE, we avoided limiting verification to three-room demonstration games. Verifying architectures against small samples obscures problems with state scaling and rule contention.

To test AIIFE against a complex benchmark, we implemented the full scope of *Zork I*: all 110 rooms, all 19 treasures, all puzzle mechanics, daemons, and combat on top of our TypeScript SDK and intent pipeline.

This article details how the architecture held up under that workload.

---

## The scale of Zork I

Porting *Zork I* to AIIFE required modeling:
- **110 rooms.** Locations ranging from the White House and Forest to the Cellar, Maze, Round Room, Dam #3, Hades, and the Coal Mine.
- **70+ game objects.** The brass lantern, elvish sword, rope, coffin, garlic, bell, book, candles, sceptre, wrench, inflatable boat, and 19 distinct treasures.
- **19 puzzle mechanics.**
  - Inflating the boat to reach the buoy in the reservoir.
  - Compressing coal into a diamond with the coal mine machine.
  - Exorcising the evil spirits at the Gate of Hades with the bell, book, and candles.
  - Tying the rope to the railing in the Dome Room to climb down.
  - Draining Reservoir #3 using the wrench on the control bolt.
  - Calming the Loud Room with the `echo` command.
  - Bypassing the Cyclops by saying `ulysses` or `odysseus`.
  - Storing treasures in the Living Room Trophy Case to earn the maximum 350-point score.
- **19 integration tests.** Automated walkthrough tests in Vitest verify every puzzle sequence end-to-end.

---

## Modeling puzzles with the authoring SDK

Classic Infocom puzzle logic maps cleanly into TypeScript using the AIIFE SDK.

### Altar teleportation and sceptre waving
In Zork, praying at the South Temple altar teleports the player to the Forest, and waving the sceptre reveals a pot of gold at the end of the rainbow.

Using `registerAction`:

```ts
registerAction(bus, registry, "pray", {
  schema: z.object({}),
  description: "pray(): Pray at an altar or sacred site.",
  handler: (event, state, world) => {
    if (state.player.current_room === "altar") {
      movePlayer(state, "forest_1");
      ensureVisited(state, "forest_1");
      return "A strange feeling overcomes you. The world dissolves into mist... You find yourself standing in a dense forest.";
    }
    return "Your prayers are whispered to the empty air.";
  },
});

registerAction(bus, registry, "wave", {
  schema: z.object({ objects: z.array(z.string()).optional() }),
  description: "wave(objects): Wave an item.",
  handler: (event, state, world) => {
    const target = getTarget(event.params);
    if (target === "sceptre" && isInInventory(state, "sceptre")) {
      if (state.player.current_room === "end_of_rainbow") {
        setObjectState(state, "pot_of_gold", "revealed", true);
        moveObject(state, "pot_of_gold", "end_of_rainbow");
        return "You wave the sceptre. A shimmering rainbow forms across the chasm, and a pot of gold solidifies at your feet.";
      }
      return "A dazzling shower of multicolored sparks glints from the sceptre's tip.";
    }
    return "You wave it foolishly about.";
  },
});
```

### The Exorcism of Hades
The exorcism requires ringing the brass bell (which heats up and drops to the floor), lighting candles with a match, and reading the black book while holding both items.

Using scoped listeners on `EventBus`:

```ts
bus.on("ring", "brass_bell", (event, state) => {
  if (state.player.current_room === "entrance_to_hades") {
    setObjectState(state, "hades_spirits", "panicked", true);
    moveObjectFromInventoryToRoom(state, "brass_bell", "entrance_to_hades");
    return "The bell emits a deafening chime. The spirits cower, covering their ears. The bell grows searingly hot, forcing you to drop it.";
  }
});
```

### The lantern battery daemon
The brass lantern provides 100 turns of light. Failing to maintain a light source in dark rooms causes the player to be eaten by a Grue.

Using `registerDaemon`:

```ts
registerDaemon(bus, "lamp-battery", {
  condition: (_, state) => state.objects.brass_lantern?.state.lit === true,
  effect: (_, state) => {
    const turns = ((state.objects.brass_lantern.state.turns_lit as number) || 0) + 1;
    state.objects.brass_lantern.state.turns_lit = turns;
    if (turns >= 100) {
      state.objects.brass_lantern.state.lit = false;
    }
  },
  feedback: (_, state) => {
    const turns = state.objects.brass_lantern.state.turns_lit as number;
    if (turns === 80) return "The brass lantern's lamp is beginning to dim.";
    if (turns >= 100) return "The brass lantern has flickered out. You are plunged into darkness.";
  },
  priority: PRIORITY.DAEMON,
});
```

---

## Verifying 110 rooms with automated tests

Because the engine decouples intent recognition from state mutations, the Zork I test suite runs without language model calls:

```ts
describe("Zork One world definition and rules", () => {
  it("navigates around the house, opens the window, enters kitchen and living room", () => { ... });
  it("moves rug, opens trapdoor, descends into cellar", () => { ... });
  it("combats troll with elvish sword and unblocks passages", () => { ... });
  it("ties rope to railing in dome room and descends to torch room", () => { ... });
  it("drains reservoir with wrench at Dam #3 and reveals trunk of jewels", () => { ... });
  it("exorcises evil spirits at Entrance to Hades with bell, candles, and book", () => { ... });
  it("operates coal mine machine to turn coal into huge diamond", () => { ... });
  it("deposits all 19 treasures into trophy case to accumulate maximum score", () => { ... });
  it("executes an end-to-end multi-room walkthrough sequence", () => { ... });
});
```

All 19 walkthrough tests run in under 60 milliseconds in Vitest.

---

## Lessons from Zork I

Porting *Zork I* validated three architectural choices:
1. **Priority bands handle complex conditions cleanly.** Numerical priority bands provided room for guard checks, mutual preemption, and cascading events without requiring monkey-patches.
2. **Dynamic context generation keeps prompt sizes bounded.** Despite 110 rooms and 70 objects, the prompt snapshot sent to the model contains only the current room, unblocked exits, and visible objects. Prompt tokens scale with room complexity rather than total world size.
3. **The SDK abstraction isolates game rules.** Game logic does not touch engine internals. All Zork rules run through `defineGame`, `registerAction`, and the SDK mutators.
