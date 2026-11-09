# Game Authoring Guide

Building an interactive fiction game in AIIFE is simple, type-safe, and modular. You define your game world using TypeScript and register custom puzzle rules and verbs through the AIIFE Authoring SDK.

---

## 1. Quick Example: A Minimal Game

Create a file in `games/my-first-adventure.ts`:

```ts
import { defineGame, type World } from "../src/sdk";

const world: World = {
  id: "my_first_adventure",
  name: "My First Adventure",
  version: "1.0.0",
  start_room: "clearing",
  rooms: {
    clearing: {
      id: "clearing",
      name: "Forest Clearing",
      descriptions: {
        default: "You stand in a sunlit forest clearing. A path leads north towards an old cottage.",
        visited: "The familiar forest clearing. The path still leads north.",
      },
      state: {},
      exits: {
        north: { leads_to: "cottage" },
      },
    },
    cottage: {
      id: "cottage",
      name: "Abandoned Cottage",
      descriptions: {
        default: "You are inside a dusty wooden cottage. The only exit is south back to the clearing.",
      },
      state: {},
      exits: {
        south: { leads_to: "clearing" },
      },
    },
  },
  objects: {
    brass_key: {
      id: "brass_key",
      name: "brass key",
      aliases: ["key", "old key"],
      type: "item",
      location: "clearing",
      state: { carriable: true },
      descriptions: {
        default: "An intricate brass key with strange engravings.",
      },
    },
  },
  player: {
    current_room: "clearing",
    inventory: [],
    state: {},
  },
};

export default defineGame({
  world,
});
```

To run your game:
```bash
npm run dev -- my-first-adventure
```

---

## 2. World Schema Breakdown

A game world definition consists of three core components: `rooms`, `objects`, and initial `player` state.

### Rooms
```ts
rooms: {
  library: {
    id: "library",
    name: "The Grand Library",
    descriptions: {
      default: "Towering bookshelves reach into shadows. Passages lead east and south.",
      visited: "The grand library. The air smells of old parchment.",
      dark: "It is pitch black. You are likely to be eaten by a grue.",
    },
    state: {
      visited: false,
      lit: false,
    },
    exits: {
      south: { leads_to: "hallway" },
      east: {
        leads_to: "study",
        condition: "study_door.open == true",
        locked_message: "The study door is firmly closed.",
      },
    },
  },
}
```
- **Descriptions**: Must have a `default` entry. State keys (such as `dark`) take precedence if their matching flag is `true` in state. If visited and no other flags match, `visited` is used.
- **Exits**: Directions can be `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`, `up`, `down`, `in`, `out`.
- **Exit Conditions**: An expression string evaluated against game state:
  - `"object_id.state_key == value"`
  - Supports `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, and `||`.
  - Example: `condition: "study_door.open == true && player.crawling == false"`.

### Objects
```ts
objects: {
  wooden_chest: {
    id: "wooden_chest",
    name: "wooden chest",
    aliases: ["chest", "box"],
    type: "container",
    location: "bedroom",
    state: {
      carriable: false,
      open: false,
      locked: true,
    },
    descriptions: {
      default: "A sturdy iron-banded wooden chest.",
      open: "An open wooden chest with a velvet lining.",
    },
    requires_instrument: {
      unlock: "iron_key", // Specifies the key required by the core "unlock" verb
    },
  },
  gold_coin: {
    id: "gold_coin",
    name: "gold coin",
    aliases: ["coin"],
    type: "item",
    location: "wooden_chest", // Nested inside container!
    state: { carriable: true },
    descriptions: {
      default: "A shiny ancient gold coin.",
    },
  },
}
```

- **Types**: `"item" | "fixture" | "container" | "door" | "actor" | "weapon" | "key"`.
- **Initial Location**: Can be a room ID (`"bedroom"`), a container ID (`"wooden_chest"`), or `"inventory"`.
- **Containers**: When an object has `type: "container"`, the engine automatically manages containment. If the container is `open: false`, objects inside are hidden from player scope. When the player opens the container, its contents are automatically revealed.
- **Keys & Locks**: Set `requires_instrument: { unlock: "key_id" }`. The core engine handles checking if the player is holding the required key.

---

## 3. Adding Game Logic with `setup(bus, registry)`

To create interactive puzzles, pass a `setup` function to `defineGame`:

```ts
export default defineGame({
  world,
  setup(bus, registry) {
    // Custom puzzle logic here!
  },
});
```

### Intercepting Existing Verbs
You can listen to any game verb before or after it runs. Use `bus.on(verb, scopeId, listener)`:

```ts
// Prevent taking the heavy iron anvil
bus.on("take", "iron_anvil", (event) => {
  event.stop(); // Stops core take action and mutator
  return "The anvil is far too heavy to lift with your bare hands.";
});
```

### Using Priority Bands
The second or third parameter allows configuring priority:
```ts
import { PRIORITY } from "../src/sdk";

// Run validation guard (runs before mutation)
bus.on("open", "trapdoor", (event, state) => {
  if (state.objects.rug?.state.moved !== true) {
    event.stop();
    return "The trapdoor is covered by a heavy rug.";
  }
}, { priority: PRIORITY.GUARD });
```

### Revealing Hidden Items
```ts
import { setObjectState } from "../src/sdk";

bus.on("examine", "bookshelf", (event, state) => {
  if (state.objects.silver_key?.state.hidden) {
    setObjectState(state, "silver_key", "hidden", false);
    return "Behind the leather-bound books, you notice a small silver key!";
  }
});
```

---

## 4. Registering Custom Verbs with `registerAction`

If your game has unique verbs (like `pray`, `dig`, `inflate`, or `cast`), register them with a Zod schema and description:

```ts
import { z } from "zod";
import { registerAction, getTarget, isInInventory, setObjectState } from "../src/sdk";

export default defineGame({
  world,
  setup(bus, registry) {
    registerAction(bus, registry, "pray", {
      schema: z.object({}),
      description: "pray(): Pray at an altar or sacred site.",
      handler: (event, state, world) => {
        if (state.player.current_room !== "temple_altar") {
          event.stop();
          return "Your prayers go unanswered here.";
        }
        return "A warm golden glow envelops you, filling you with renewed vigor.";
      },
    });

    registerAction(bus, registry, "dig", {
      schema: z.object({ objects: z.array(z.string()).optional() }),
      description: "dig(objects): Dig in the ground or sand. Requires a shovel.",
      handler: (event, state, world) => {
        if (!isInInventory(state, "shovel")) {
          event.stop();
          return "You have nothing to dig with.";
        }
        if (state.player.current_room !== "sandy_beach") {
          event.stop();
          return "The ground here is too hard to dig.";
        }
        setObjectState(state, "buried_chest", "revealed", true);
        return "You dig into the soft sand and unearth a buried chest!";
      },
    });
  },
});
```

> [!NOTE]
> When you register an action, its `description` and schema are automatically provided to the LLM's system prompt so it recognizes player commands like *"dig in the sand"* or *"start praying"*.

---

## 5. Background Daemons with `registerDaemon`

Daemons run automatically every turn after actions have completed. They are perfect for lighting mechanics, NPC movement, or hunger timers:

```ts
import { registerDaemon, PRIORITY, isInInventory } from "../src/sdk";

// Diminishing lantern oil
registerDaemon(bus, "lantern-fuel", {
  condition: (_, state) => state.objects.brass_lantern?.state.lit === true,
  effect: (_, state) => {
    const fuel = (state.objects.brass_lantern.state.fuel as number) ?? 100;
    state.objects.brass_lantern.state.fuel = fuel - 1;
  },
  feedback: (_, state) => {
    const fuel = state.objects.brass_lantern.state.fuel as number;
    if (fuel === 10) return "Your lantern is beginning to flicker dimly.";
    if (fuel <= 0) {
      state.objects.brass_lantern.state.lit = false;
      return "Your lantern has run out of oil and gone out!";
    }
  },
  priority: PRIORITY.DAEMON,
});
```

---

## 6. Testing Your Game

AIIFE games are 100% deterministic, meaning you can write comprehensive automated unit tests for puzzle solutions:

```ts
import { describe, it, expect } from "vitest";
import { GameEngine } from "../src/engine/game-engine";
import myGame from "./my-first-adventure";

describe("My First Adventure Walkthrough", () => {
  it("allows player to navigate and pick up the key", () => {
    const engine = new GameEngine(myGame.world, myGame.setup);
    engine.start();

    // Look
    const lookOut = engine.runAction({ action: "look", direction: null, objects: null, preposition: null, message: null });
    expect(lookOut).toContain("Forest Clearing");

    // Take key
    const takeOut = engine.runAction({ action: "take", direction: null, objects: ["brass_key"], preposition: null, message: null });
    expect(takeOut).toContain("Taken.");

    // Move north
    const moveOut = engine.runAction({ action: "go", direction: "north", objects: null, preposition: null, message: null });
    expect(moveOut).toContain("Abandoned Cottage");
  });
});
```

See [games/troll.test.ts](file:///Users/alex/Code/alex/aiife/games/troll.test.ts) and [games/zork-one.test.ts](file:///Users/alex/Code/alex/aiife/games/zork-one.test.ts) for production test suites.
