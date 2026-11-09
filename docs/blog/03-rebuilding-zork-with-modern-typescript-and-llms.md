# Rebuilding Zork I with Modern TypeScript, Priority Events, and LLMs

*By the AIIFE Engineering Team*

---

In 1977, Tim Anderson, Marc Blank, Bruce Daniels, and Dave Lebling created *Zork* at MIT. Over the next decade, Infocom turned it into the definitive benchmark of interactive fiction. *Zork I: The Great Underground Empire* featured over 100 rooms, dozens of interconnected puzzles, dynamic inventory limits, a wandering thief, a combat system, and an iconic parser.

When building AIIFE, we did not want a toy demonstration with a 3-room demo where you pick up a brass key and unlock a door. Toy architectures break down the moment they encounter real game complexity.

To prove that AIIFE was a true, production-grade interactive fiction engine, we gave ourselves a challenge:

**Rebuild the entire full game of Zork I—all 110 rooms, all 19 treasures, all complex puzzles, daemons, and combat—on top of our modern TypeScript SDK and LLM intent pipeline.**

Here is what we learned and how the architecture held up under the weight of an IF legend.

---

## 1. The Scale of Zork I in Numbers

Porting *Zork I* to AIIFE meant modeling:
- **110 Rooms**: From the White House and Forest to the Cellar, Maze, Round Room, Dam #3, Hades, and the Coal Mine.
- **70+ Game Objects**: The brass lantern, elvish sword, rope, coffin, garlic, bell, book, candles, sceptre, wrench, inflatable boat, and 19 distinct treasures.
- **19 Complex Puzzle Mechanics**:
  - Pumping up the inflatable boat to reach the buoy in the reservoir.
  - Turning coal into a huge diamond using the coal mine machine.
  - Exorcising the evil spirits at the Gate of Hades with the bell, book, and candles.
  - Tying the rope to the railing in the Dome Room to rappel down.
  - Draining Reservoir #3 using the wrench on the control bolt.
  - Quieting the Loud Room with the `echo` command.
  - Outwitting the Cyclops by mentioning `ulysses` or `odysseus`.
  - Storing treasures in the Living Room Trophy Case to earn the maximum 350-point score.
- **19 Automated Walkthrough Integration Tests**: Every single puzzle chain and multi-room progression verified with end-to-end tests running under Vitest.

---

## 2. Modeling Zork's Puzzles with the AIIFE SDK

Let's look at how classic Infocom puzzle logic translates into clean, modern TypeScript using AIIFE's SDK.

### The Altar Teleport and Sceptre Wave
In Zork, praying at the South Temple altar teleports the player to the Forest, and waving the sceptre reveals a pot of gold at the end of the rainbow.

Using `registerAction`:

```ts
// Custom 'pray' verb
registerAction(bus, registry, "pray", {
  schema: z.object({}),
  description: "pray(): Pray at an altar or sacred site.",
  handler: (event, state, world) => {
    if (state.player.current_room === "altar") {
      movePlayer(state, "forest_1");
      ensureVisited(state, "forest_1");
      return "A strange feeling overcomes you. The world dissolves into mist... You find yourself standing in a dense forest!";
    }
    return "Your prayers are whispered to the empty air.";
  },
});

// Custom 'wave' verb
registerAction(bus, registry, "wave", {
  schema: z.object({ objects: z.array(z.string()).optional() }),
  description: "wave(objects): Wave an item.",
  handler: (event, state, world) => {
    const target = getTarget(event.params);
    if (target === "sceptre" && isInInventory(state, "sceptre")) {
      if (state.player.current_room === "end_of_rainbow") {
        setObjectState(state, "pot_of_gold", "revealed", true);
        moveObject(state, "pot_of_gold", "end_of_rainbow");
        return "You wave the sceptre. A shimmering rainbow forms across the chasm, and a pot of gold solidifies at your feet!";
      }
      return "A dazzling shower of multicolored sparks glints from the sceptre's tip.";
    }
    return "You wave it foolishly about.";
  },
});
```

### The Exorcism of Hades
One of Zork's most memorable set-pieces requires ringing the brass bell (which becomes red-hot and falls to the ground), lighting candles with a match, and reading the black book while holding them.

Using scoped listeners on the `EventBus`:

```ts
bus.on("ring", "brass_bell", (event, state) => {
  if (state.player.current_room === "entrance_to_hades") {
    setObjectState(state, "hades_spirits", "panicked", true);
    // Bell becomes too hot to hold and drops to floor
    moveObjectFromInventoryToRoom(state, "brass_bell", "entrance_to_hades");
    return "The bell emits a deafening chime! The spirits cower, covering their ears. The bell grows searingly hot, forcing you to drop it!";
  }
});
```

### The Lantern Battery Daemon
The brass lantern only has 100 turns of battery. In Zork, failing to keep a light source lit in dark rooms causes the player to be eaten by a Grue.

We modeled this using `registerDaemon`:

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
    if (turns >= 100) return "The brass lantern has flickered out! You are plunged into darkness.";
  },
  priority: PRIORITY.DAEMON,
});
```

---

## 3. Testing 110 Rooms with 100% Determinism

Because AIIFE decouples intent recognition from the rules engine, our entire Zork I test suite runs without calling an LLM:

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

**All 19 tests pass in under 50 milliseconds.**

---

## 4. What Zork Taught Us

Building *Zork I* proved that our architecture was ready:
1. **The Priority Band system scaled flawlessly.** We never needed hacks or monkey-patching to handle Zork's complex puzzle conditions.
2. **Dynamic context generation kept the LLM accurate.** Even with 110 rooms and 70 objects, the parser context snapshot sent to the LLM only ever contains the current room and its visible objects. The prompt size never blew up.
3. **The SDK abstraction works.** Game code never touches engine internals. All of Zork's rules were authored cleanly using `defineGame`, `registerAction`, and the SDK mutators.

AIIFE isn't just an experimental AI toy—it is a robust, battle-tested interactive fiction platform capable of running full-scale, iconic games.
