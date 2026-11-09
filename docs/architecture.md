# Architecture Deep Dive

AIIFE (AI Interactive Fiction Engine) is a layered, deterministic text adventure engine augmented with a hybrid natural language parser and multilingual narrator.

Unlike pure generative text games where an LLM invents the world on the fly, AIIFE enforces strict game state, immutable mutations, physical scope rules, and an event-driven rules layer. The LLM acts as an **intent translator** and **multilingual bridge**, not the game arbiter.

---

## High-Level System Architecture

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
│  │ Scope Validation (isInScope / Ambient targets)                   │  │
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
│  │ SaveStorageAdapter (File / Memory)                               │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │ Feedback string[]                  │
│                                   ▼                                    │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ Deterministic Feedback
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Narrator Layer (streamText)                          │
│  - English: Pass-through deterministic prose (Zero latency / cost)     │
│  - Non-English: Live translation matching player's language            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. The Five Core Layers

### Layer 1: State & World Model
- **World Definition (`World`)**: The static, authored blueprint of the game world—rooms, objects, descriptions, initial locations, and exit connections. Authored in TypeScript via `defineGame()` or as pure JSON.
- **Runtime State (`GameState`)**: The serializable, minimal snapshot of everything mutable at turn $N$:
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
- **Single Source of Truth for Position**: In AIIFE, object position is stored exclusively in `state.objects[id].location`. Rooms and player inventory do not keep duplicate object ID arrays. Player inventory is purely a query: `location === "inventory"`.
- **Immutability via Immer**: All state transitions are performed through `immutable(state, fn)` wrapping Immer's `produce()`. Even during execution, if an event is cancelled midway, state rollback is free and automatic.

### Layer 2: World & Scope Derivation
The world layer computes runtime context for actions and the parser:
- **Scope Resolution (`isInScope`)**: An object is accessible only if it is:
  1. In the current room (`location === player.current_room`).
  2. In the player's inventory (`location === "inventory"`).
  3. Inside an *open* container currently in scope (`findOpenContainerInRoom`).
- **Dynamic Descriptions**: Descriptions support state flags (`visited`, `dark`, or custom flags like `knocked_out`). `resolveRoomDescription` and `resolveObjectDescription` evaluate matching state flags and fall back to `default`.
- **Condition Evaluator**: Expressions like `"library_door.open == true"` or `"troll.knocked_out == true"` are parsed and evaluated dynamically against rooms, objects, and player state. Compound conditions with `&&` and `||` are supported.
- **Parser Context Snapshot (`buildParserContext`)**: Constructed each turn to supply the LLM with room details, available (unblocked) exits, and strictly in-scope objects.

### Layer 3: Rules & Event Bus
The event system coordinates game verbs, guards, and consequences:
- **`ActionRegistry`**: Central registry for game actions. Each action provides a Zod parameter schema, documentation description, aliases, and hints.
- **`EventBus`**: Executes listeners across five distinct **Priority Bands**:
  1. `PRIORITY.GUARD` (50): Precondition checks and validation. Can cancel actions via `event.stop()`.
  2. `PRIORITY.MUTATION` (100): Core state changes (e.g. moving an object).
  3. `PRIORITY.POST_MUTATION` (110): Immediate reactions (e.g. spilling contents when an object breaks).
  4. `PRIORITY.EFFECT` (150): Side effects, descriptive feedback, and sub-actions.
  5. `PRIORITY.DAEMON` (200): Recurring background turns (timers, lanterns, NPC behaviors).
- **Scoped Preemption**: Registering a listener on an object or room (`bus.on("take", "sword", ...)`) automatically preempts global listeners registered at that same priority.

### Layer 4: Hybrid Intent Recognition
Natural language parsing combines high speed with deep flexibility:
- **Fast-Path Regex Parser**: Standard IF abbreviations and canonical commands (`n`, `s`, `look`, `i`, `take brass lantern`, `drop sword`, `save`, `undo`) are parsed in sub-millisecond time with zero LLM API calls.
- **LLM Structured Output**: Complex phrasing, synonyms, or conversational commands are parsed using `@ai-sdk`'s `generateText` into a validated `RecognizedIntent`. The LLM's prompt is dynamically injected with the current room context and available actions from `ActionRegistry.getIntentMeta()`.
- **Scope Gatekeeper**: Before any action runs, `allTargetsInScope` verifies that referenced objects are physically accessible. If not, the engine immediately responds with *"You don't see that here."* without mutating state.

### Layer 5: Narration & Terminal Presentation
- **Deterministic First**: If the engine produces explicit feedback (e.g., *"Taken."*, *"The heavy oak door is locked."*, or room descriptions), that text is rendered directly for English input.
- **Multilingual Bridge**: When player input contains non-English characters or the player converses in another language, the `NARRATION_SYSTEM_PROMPT` translates the deterministic game output into the player's language on the fly via `streamText`.
- **Ink UI**: Terminal interface built with React and Ink, providing command history (up/down arrows), cursor editing, animated spinners, and live token usage tracking.

---

## 2. Turn Execution Lifecycle

Every player interaction follows a deterministic lifecycle:

```
1. Player enters: "unlock the heavy door with the brass key"
2. Fast-Path Check:
   - Not a simple abbreviation -> forwarded to LLM.
3. LLM Intent Recognition:
   - System prompt built with buildParserContext() + registry.getIntentMeta()
   - Generates structured intent:
     { action: "unlock", objects: ["cellar_door", "brass_key"] }
4. Scope Validation:
   - Verifies "cellar_door" and "brass_key" are in current scope.
5. Action Execution (executeUntrustedAction):
   - Parameters validated against action schema.
   - EventBus emits "unlock" event.
   - Priority 50 (GUARD): Checks if key is in inventory and fits the lock.
   - Priority 100 (MUTATION): Sets cellar_door.locked = false.
   - Returns feedback: "Unlocked."
6. Turn Tick:
   - State pushed to history stack (up to 50 turns for undo).
   - EventBus emits "tick".
   - Daemons execute (e.g., lantern fuel decrements).
7. Narration:
   - Deterministic feedback passed to UI (or translated if non-English).
```

---

## 3. Storage and Persistence

AIIFE decouples persistence from engine logic through the `SaveStorageAdapter` interface:

```ts
export interface SaveStorageAdapter {
  save(worldId: string, slot: string, data: SaveFile): void;
  load(worldId: string, slot: string): SaveFile | null;
  exists(worldId: string, slot: string): boolean;
  list(worldId: string): string[];
}
```

- **In-Memory**: Used automatically during tests (`MemorySaveStorage`).
- **File System**: Persists JSON files in the workspace (`FileSaveStorage`).
- **Slots**: Players can manage multiple save files (`save slot1`, `restore slot1`).

---

## 4. Game Authoring SDK

AIIFE exports a dedicated SDK for creating games without touching engine internals:

```bash
import { defineGame, PRIORITY, registerAction, registerDaemon } from "aiife/sdk";
```

The SDK provides:
- Type definitions (`World`, `Room`, `GameObject`, `GameState`).
- Core mutators (`moveObject`, `setObjectState`, `ensureVisited`, `isInInventory`).
- Rule authoring helpers (`getTarget`, `getInstrument`, `runAction`).
- Game definition wrapper (`defineGame`).
