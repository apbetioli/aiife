# System architecture

AIIFE pairs a deterministic text adventure engine with a natural language parser and a streaming translation layer.

Generative text games allow models to invent world state during play. AIIFE separates state transitions from language generation. The engine validates physical scope, executes state machines, and enforces priority-banded events. The language model maps user input to structured actions and translates engine responses into other languages.

---

## High-level system architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Terminal UI (React + Ink)                       │
│             Input History, Token Stats, Stream Output                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Player Input
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            GameAgent                                   │
│  ┌─────────────────────────┐          ┌─────────────────────────────┐  │
│  │ Fast-Path Parser (Regex)│──Miss───▶│ Intent LLM (generateText)   │  │
│  │ "n", "look", "i", etc.  │          │ Guided by ActionRegistry    │  │
│  └────────────┬────────────┘          └──────────────┬──────────────┘  │
│               │ Hit                                  │ Structured      │
│               ▼                                      ▼ Intent          │
│               └───────────────────┬──────────────────┘                 │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ RecognizedIntent
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            GameEngine                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Scope Validation (isInScope, Ambient targets)                    │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ Valid targets                      │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ EventBus with Priority Bands (PRIORITY.GUARD -> MUTATION -> ...) │  │
│  │ Core Actions + Custom Game Rules + Daemons                       │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ State Mutation (Immer)             │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ World & State: Single Source of Truth, Undo Stack (50 turns)     │  │
│  │ SaveStorageAdapter (FileSaveStorage, MemorySaveStorage)          │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ Feedback string[]                  │
│                                   ▼                                    │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ Deterministic Feedback
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Narrator Layer (streamText)                          │
│  - English: Pass-through deterministic prose (zero latency and cost)   │
│  - Non-English: Live translation matching player's language            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## The five engine layers

### Layer 1: State and world model
- **World definition (`World`).** The static blueprint of the game world: rooms, objects, descriptions, initial locations, and exit connections. Authors write definitions in TypeScript through `defineGame()` or load them from JSON.
- **Runtime state (`GameState`).** The minimal serializable snapshot of mutable data at turn $N$:
  ```ts
  interface GameState {
    world_id: string;
    version: string;
    turn: number;
    player: {
      current_room: string;
      state: Record<string, boolean | string | number>;
    };
    rooms: Record<string, { state: Record<string, boolean | string | number> }>;
    objects: Record<string, { location: string; state: Record<string, boolean | string | number> }>;
  }
  ```
- **Single source of truth for position.** The engine stores object position in `state.objects[id].location`. Rooms and the player inventory do not keep secondary arrays of object IDs. Player inventory is a query: `location === "inventory"`.
- **Immutability through Immer.** The helper `immutable(state, fn)` wraps Immer's `produce()`. If an event handler calls `event.stop()` midway through a turn, the engine discards the draft without modifying committed state.

### Layer 2: World and scope derivation
The world layer computes runtime context for actions and the parser:
- **Scope resolution (`isInScope`).** An object is accessible only when it meets one of three conditions:
  1. It sits in the current room (`location === player.current_room`).
  2. It sits in the player's inventory (`location === "inventory"`).
  3. It sits inside an open container in scope (`findOpenContainerInRoom`).
- **Dynamic descriptions.** Descriptions support state flags such as `visited` and `dark`. Functions `resolveRoomDescription` and `resolveObjectDescription` inspect active state flags and fall back to `default`.
- **Condition evaluation.** The engine evaluates expression strings such as `"library_door.open == true"` against rooms, objects, and player state. The parser supports comparisons (`==`, `!=`, `<`, `>`, `<=`, `>=`) and logical operators (`&&`, `||`).
- **Parser context snapshot (`buildParserContext`).** On every turn, this builder produces room details, unblocked exits, and accessible objects for the language model prompt.

### Layer 3: Rules and event bus
The event system coordinates actions, validation checks, and side effects:
- **`ActionRegistry`.** Central registry for player actions. Each action provides a Zod schema for parameters, documentation for the prompt, aliases, and hints.
- **`EventBus`.** Executes listeners across five priority bands:
  1. `PRIORITY.GUARD` (50): Precondition checks. Calling `event.stop()` halts execution.
  2. `PRIORITY.MUTATION` (100): Core state changes, such as moving an item or updating a flag.
  3. `PRIORITY.POST_MUTATION` (110): Direct reactions, such as spilling liquid from a dropped bottle.
  4. `PRIORITY.EFFECT` (150): Side effects, descriptive text, and secondary events.
  5. `PRIORITY.DAEMON` (200): Recurring turn-end updates, such as lantern fuel timers or NPC movement.
- **Scoped preemption.** A listener registered for a specific target (`bus.on("take", "sword", ...)`) preempts global listeners registered at that same priority band.

### Layer 4: Hybrid intent recognition
The engine pairs two parsers to minimize cost and latency:
- **Fast-path parser.** Matches standard abbreviations and common commands (`n`, `s`, `look`, `i`, `take lantern`, `drop sword`, `save`, `undo`) using regular expressions in `src/agent/fast-path-parser.ts`. These commands run in under 1 ms without network requests.
- **Scoped tool calling.** For phrasing not handled by the fast path, `GameAgent` invokes `@ai-sdk`'s `generateText` with tools built by `buildScopedTools`. Tools exposed to the model are restricted to the player's room and active inventory.
- **Scope validation.** Before dispatching an action, `allTargetsInScope` confirms that every target object is physically reachable. If an object is not reachable, the engine returns `"You don't see that here."` and skips mutation.

### Layer 5: Narration and terminal presentation
- **Deterministic output.** When the engine produces exact feedback in English, the interface displays the text directly without calling a language model.
- **Streaming translation.** When player input contains non-English characters or the player writes in another language, `streamText` translates the deterministic game output into the target language.
- **Terminal UI.** The Ink and React frontend provides command history, arrow navigation, streaming text, animated spinners, and live token metrics.

---

## Turn execution lifecycle

Every player action follows seven steps:

1. The player enters an action: `"unlock the heavy door with the brass key"`.
2. The fast-path parser checks for a matching regular expression. The input is not a standard abbreviation, so the parser forwards the text to the model.
3. The model selects a tool from `buildScopedTools()`:
   `unlock(objects: ["cellar_door", "brass_key"])`.
4. Scope validation verifies that both `cellar_door` and `brass_key` are in scope.
5. The engine executes the action:
   - Validates parameters against the action schema.
   - Emits the `unlock` event on `EventBus`.
   - `PRIORITY.GUARD` confirms that the key matches the door lock.
   - `PRIORITY.MUTATION` sets `cellar_door.locked = false`.
   - Returns feedback: `"Unlocked."`.
6. The engine ticks the turn:
   - Appends current state to the 50-turn undo history.
   - Emits the `tick` event on `EventBus`.
   - Runs daemons, such as decrementing lantern fuel.
7. The narrator layer sends feedback:
   - Prints deterministic text directly for English input.
   - Streams translation for non-English input.

---

## Storage and persistence

The engine isolates persistence behind the `SaveStorageAdapter` interface:

```ts
export interface SaveStorageAdapter {
  save(worldId: string, slot: string, data: SaveFile): void;
  load(worldId: string, slot: string): SaveFile | null;
  exists(worldId: string, slot: string): boolean;
  list(worldId: string): string[];
}
```

- **Memory storage (`MemorySaveStorage`).** Stores snapshots in memory. Integration and unit tests use this adapter.
- **File storage (`FileSaveStorage`).** Persists JSON save files to disk in the project directory.
- **Named slots.** Players specify target slots with `save slot1` and `restore slot1`.

---

## Authoring SDK

AIIFE exports authoring types and functions from `aiife/sdk`:

```ts
import { defineGame, PRIORITY, registerAction, registerDaemon } from "aiife/sdk";
```

The package provides:
- Core interfaces: `World`, `Room`, `GameObject`, and `GameState`.
- State mutators: `moveObject`, `setObjectState`, `ensureVisited`, and `isInInventory`.
- Rule authoring utilities: `getTarget`, `getInstrument`, and `runAction`.
- The game definition helper: `defineGame`.
