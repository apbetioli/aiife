# Authoring guide

This guide shows you how to define game worlds, register actions, handle state transitions, and test puzzles with the AIIFE authoring SDK.

---

## Define a minimal game

Create a game definition in `games/my-first-adventure.ts`:

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
    state: {},
  },
};

export default defineGame({
  world,
});
```

To run the game, pass its filename without the extension:
```bash
npm run dev -- my-first-adventure
```

---

## Configure rooms and exits

A room requires an identifier, a display name, a descriptions record, and an exits record:

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

- **Descriptions.** Each room requires a `default` entry. State keys take precedence when their matching flag evaluates to `true`. If the player has visited the room and no custom flags match, the engine uses the `visited` description.
- **Exit directions.** Supported directions are `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`, `up`, `down`, `in`, and `out`.
- **Exit conditions.** Condition strings evaluate against game state properties using comparisons (`==`, `!=`, `<`, `>`, `<=`, `>=`) and logical operators (`&&`, `||`):
  `condition: "study_door.open == true && player.crawling == false"`

## Configure objects and containers

Objects represent carriable items, scenery, doors, and containers:
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

- **Object types.** Supported types are `"item"`, `"fixture"`, `"container"`, `"door"`, `"actor"`, `"weapon"`, and `"key"`.
- **Initial location.** Set `location` to a room identifier, a container identifier, or `"inventory"`.
- **Containers.** When an object has `type: "container"`, the engine resolves contents dynamically. If `open` is `false`, objects inside remain hidden from scope. Opening the container places its contents into scope.
- **Keys and locks.** Specify keys in `requires_instrument: { unlock: "key_id" }`. The built-in `unlock` action checks whether the player holds the required key in inventory.

---

## Intercept standard actions

To add puzzle rules to existing verbs, provide a `setup` callback to `defineGame`:

```ts
export default defineGame({
  world,
  setup(bus, registry) {
    bus.on("take", "iron_anvil", (event) => {
      event.stop();
      return "The anvil is far too heavy to lift with your bare hands.";
    });
  },
});
```

### Precondition guards
To prevent an action before state mutates, register a listener at `PRIORITY.GUARD`:

```ts
import { PRIORITY } from "../src/sdk";

bus.on("open", "trapdoor", (event, state) => {
  if (state.objects.rug?.state.moved !== true) {
    event.stop();
    return "The trapdoor is covered by a heavy rug.";
  }
}, { priority: PRIORITY.GUARD });
```

### Revealing hidden items
To reveal hidden items during examination, update the item's state in place:

```ts
import { setObjectState } from "../src/sdk";

bus.on("examine", "bookshelf", (event, state) => {
  if (state.objects.silver_key?.state.hidden) {
    setObjectState(state, "silver_key", "hidden", false);
    return "Behind the leather-bound books, you notice a small silver key.";
  }
});
```

---

## Register custom actions

To introduce new verbs such as `pray`, `dig`, or `rub`, register them with `registerAction`:

```ts
import { z } from "zod";
import { registerAction, isInInventory, setObjectState } from "../src/sdk";

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
        return "You dig into the soft sand and unearth a buried chest.";
      },
    });
  },
});
```

The function `registerAction` adds the verb to `EventBus` and injects its description and parameter schema into the model's tool definitions.

---

## Register background daemons

Daemons run on every turn after player actions complete. Use daemons for timers, torch fuel, and autonomous actor movement:

```ts
import { registerDaemon, PRIORITY } from "../src/sdk";

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
      return "Your lantern has run out of oil and gone out.";
    }
  },
  priority: PRIORITY.DAEMON,
});
```

---

## Test puzzle solutions

Engine turns execute deterministically without external API calls, which allows you to test puzzle walkthroughs with Vitest:

```ts
import { describe, it, expect } from "vitest";
import { GameEngine } from "../src/engine/game-engine";
import myGame from "./my-first-adventure";

describe("My First Adventure Walkthrough", () => {
  it("allows player to navigate and pick up the key", () => {
    const engine = new GameEngine(myGame.world, myGame.setup);
    engine.start();

    const lookOut = engine.runAction({
      action: "look",
      direction: null,
      objects: null,
      preposition: null,
      message: null,
    });
    expect(lookOut).toContain("Forest Clearing");

    const takeOut = engine.runAction({
      action: "take",
      direction: null,
      objects: ["brass_key"],
      preposition: null,
      message: null,
    });
    expect(takeOut).toContain("Taken.");

    const moveOut = engine.runAction({
      action: "go",
      direction: "north",
      objects: null,
      preposition: null,
      message: null,
    });
    expect(moveOut).toContain("Abandoned Cottage");
  });
});
```

For full adventure test suites, read [games/troll.test.ts](file:///Users/alex/Code/alex/aiife/games/troll.test.ts) and [games/zork-one.test.ts](file:///Users/alex/Code/alex/aiife/games/zork-one.test.ts).
