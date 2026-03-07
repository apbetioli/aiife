# Interactive Fiction Engine — Implementation Plan

A layered, event-driven text adventure engine with an LLM parser and narrator.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Narrative Layer                    │
│         narrate(world, state, command, feedback)    │
├─────────────────────────────────────────────────────┤
│                   Parser Layer                      │
│         parse(context, input) → ParsedCommand       │
├─────────────────────────────────────────────────────┤
│                   Rules Layer                       │
│  ┌───────────────────────────────────────────────┐  │
│  │              Event Bus                        │  │
│  │  before → on → after                          │  │
│  │  core listeners + world listeners + behaviours│  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│                   World Layer                       │
│        moveObject* / setState / buildParserContext  │
├─────────────────────────────────────────────────────┤
│                   State Layer                       │
│        GameState / save / load / buildInitialState  │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1 — State Layer

> **Goal:** Stable data foundation. Everything else builds on this.
> **Deliverable:** A validated, serialisable game state that can be built from a world definition and round-tripped through save/load.

### 1.1 Define Schemas

- [ ] `StateSchema` — generic key/value state flags
- [ ] `GameObjectSchema` — id, name, synonyms, type, carriable, state, descriptions (no location — ownership is derived from room/player contains lists)
- [ ] `RoomSchema` — id, name, descriptions, state, exits, contains
- [ ] `ExitSchema` — leads_to, condition, locked_message
- [ ] `PlayerSchema` — current_room, inventory, state
- [ ] `WorldSchema` — id, name, version, start_room, rooms, objects, player
- [ ] `GameStateSchema` — world_id, version, turn, player, rooms, objects

### 1.2 World Integrity Validators

- [ ] `validateAllObjectsOwned` — every object id in `world.objects` appears in exactly one owner's contains list (room or player inventory) — no orphaned or double-owned objects
- [ ] `validateContainment` — every id in `room.contains`, `object.contains`, and `player.inventory` references a real object in `world.objects`
- [ ] `validateExitConditions` — exit conditions reference real object ids and valid target rooms

### 1.3 State Builder

- [ ] `buildInitialState(world)` — derives mutable `GameState` from static world definition
  - copies all room contains lists
  - copies all object state flags (no location — position is derived from contains lists)
  - copies player inventory and state
  - runs all validators before returning
  - throws with descriptive errors on failure

### 1.4 Save / Load

- [ ] `SaveFile` type — schema_version, saved_at, world_id, state
- [ ] `save(state): SaveFile`
- [ ] `load(file): GameState`
- [ ] Schema migration hook for future version changes

### 1.5 Tests

- [ ] Valid world builds without errors
- [ ] Orphaned object (not in any contains list) throws with correct message
- [ ] Double-owned object (appears in two contains lists) throws with correct message
- [ ] Contains list referencing unknown object id throws
- [ ] Invalid exit condition reference throws
- [ ] Save → load round-trip produces identical state

---

## Phase 2 — World Layer

> **Goal:** Pure state mutation functions and scope resolution. No side effects, no I/O.
> **Deliverable:** A set of immutable state transformers and a working `buildParserContext`.

> **Design note — single source of truth:** Object position is owned exclusively by contains lists (rooms, containers, player inventory). There is no `location` field on objects. Because the parser context already scopes everything to the current room and inventory before a command reaches the rules layer, action handlers never need to search globally for an object — they only ever need to know "is this in the room?" or "is this in inventory?". Global search is only needed for Phase 8 concerns like actor scheduling, and even then is scoped to known possible locations.

### 2.1 State Mutators

All mutators return a new `GameState` — never mutate in place.

- [ ] `isInRoom(state, objectId)` — returns true if objectId is in the current room's contains list
- [ ] `isInInventory(state, objectId)` — returns true if objectId is in player inventory
- [ ] `moveObjectFromRoomToInventory(state, objectId)` — removes from current room contains, adds to player inventory
- [ ] `moveObjectFromInventoryToRoom(state, objectId, roomId)` — removes from player inventory, adds to room contains
- [ ] `moveObjectFromContainerToInventory(state, objectId, containerId)` — removes from container contains, adds to player inventory
- [ ] `moveObjectFromInventoryToContainer(state, objectId, containerId)` — removes from player inventory, adds to container contains
- [ ] `setObjectState(state, objectId, key, value)` — sets a single flag on an object
- [ ] `setRoomState(state, roomId, key, value)` — sets a single flag on a room
- [ ] `setPlayerState(state, key, value)` — sets a single flag on the player
- [ ] `movePlayer(state, roomId)` — updates player current_room
- [ ] `ensureVisited(state, roomId)` — marks room as visited if not already

### 2.2 Condition Evaluator

- [ ] `evaluateCondition(condition, state)` — parses and evaluates `"objectId.key operator value"` expressions
  - supports `==`, `!=`, `<`, `>`, `<=`, `>=`
  - coerces string values to correct types (true/false → boolean, numeric strings → number)
  - returns false with console warning on unparseable condition

### 2.3 Description Resolver

- [ ] `resolveRoomDescription(room, roomState)` — picks correct description variant based on state flags, falls back to `visited` then `default`
- [ ] `resolveObjectDescription(obj, objState)` — same pattern for objects

### 2.4 Parser Context Builder

- [ ] `buildParserContext(world, state)` — derives `ParserContext` from current state
  - resolves available vs blocked exits using condition evaluator
  - builds `in_scope_objects` from room contains + inventory, tagged with `source: "room" | "inventory"`
  - excludes objects inside closed containers
  - validates output with `ParserContextSchema` before returning

### 2.5 Tests

- [ ] `isInRoom` returns true for object in current room, false otherwise
- [ ] `isInInventory` returns true for object in inventory, false otherwise
- [ ] `moveObjectFromRoomToInventory` removes from room contains and adds to inventory
- [ ] `moveObjectFromInventoryToRoom` removes from inventory and adds to room contains
- [ ] `moveObjectFromContainerToInventory` removes from container contains and adds to inventory
- [ ] `moveObjectFromInventoryToContainer` removes from inventory and adds to container contains
- [ ] Each move mutator throws if the object is not in the expected source
- [ ] No object appears in more than one contains list after any move
- [ ] Condition evaluator handles all operators and type coercions
- [ ] Blocked exit returns correct locked_message
- [ ] Closed container contents are excluded from scope
- [ ] Inventory objects are tagged `source: "inventory"`
- [ ] Room objects are tagged `source: "room"`

---

## Phase 3 — Rules Layer (Event Bus)

> **Goal:** Extensible action execution via a three-phase event system.
> **Deliverable:** A working event bus with core listeners covering all base verbs, and behaviour factories for common patterns.

### 3.1 Event System Types

- [ ] `EventName` union type — all supported verbs + `enter`, `exit`, `tick`, `game:start`, `game:end`
  - player navigation verb: `go`
  - object interaction verbs: `take`, `drop`, `open`, `close`, `unlock`, `lock`, `examine`, `use`, `move`, `attack`, `talk`
- [ ] `EventPhase` — `"before" | "on" | "after"`
- [ ] `GameEvent<P>` — name, phase, params, cancelled, cancelReason
- [ ] `EventListener<P>` — `(event, world, state) => GameState`
- [ ] `ListenerRegistration` — scope, scopeId, event, phase, listener, priority, once

### 3.2 Event Bus

- [ ] `EventBus` class
  - [ ] `on(scope, scopeId, phase, event, listener, options)` — register listener, returns unsubscribe fn
  - [ ] `onObject(phase, event, id, listener)` — convenience wrapper
  - [ ] `onRoom(phase, event, id, listener)` — convenience wrapper
  - [ ] `onGlobal(phase, event, listener)` — convenience wrapper
  - [ ] `emit(event, world, state, scope)` — runs matching listeners in priority order, returns `{ state, event }`
  - [ ] Listeners sorted by priority on registration
  - [ ] `once: true` listeners auto-remove after firing

### 3.3 Action Executor

- [ ] `executeAction(bus, world, state, action, params)` — runs before → on → after phases
  - before phase: stops on first cancellation
  - on phase: core mutation
  - after phase: side effects
  - returns `{ state, feedback }`

### 3.4 Core Listeners

Register once at engine boot. These are the baseline mutations for every verb:

- [ ] `take` on — `moveObjectFromRoomToInventory`
- [ ] `drop` on — `moveObjectFromInventoryToRoom` to current room
- [ ] `open` on — `setObjectState(target, "open", true)`
- [ ] `close` on — `setObjectState(target, "open", false)`
- [ ] `unlock` on — `setObjectState(target, "locked", false)`
- [ ] `lock` on — `setObjectState(target, "locked", true)`
- [ ] `examine` on — `setObjectState(target, "examined", true)`
- [ ] `go` on — fires `exit` on current room then `enter` on destination room, calls `movePlayer`
- [ ] `move` on — `setObjectState(target, ...)` for push/pull state changes (object stays in room)
- [ ] `exit` on — (no mutation, fires for room exit listeners)
- [ ] `tick` on — increment `player.state.moves`

### 3.5 Core Before-Guards

Global precondition checks that prevent nonsensical actions:

- [ ] `take` before — cancel if `isInInventory(state, target)` ("You're already carrying that.")
- [ ] `take` before — cancel if `!carriable` ("You can't take that.")
- [ ] `open` before — cancel if `state.locked === true` ("It's locked.")
- [ ] `open` before — cancel if `state.open === true` ("It's already open.")
- [ ] `close` before — cancel if `state.open === false` ("It's already closed.")
- [ ] `unlock` before — cancel if instrument not in inventory ("You don't have anything to unlock it with.")
- [ ] `unlock` before — cancel if wrong instrument ("That doesn't fit the lock.")
- [ ] `enter` before — cancel if exit condition not met (uses locked_message)

### 3.6 Behaviour Factories

Reusable functions that register listener patterns for common object types:

- [ ] `registerLockable(bus, objectId, options)` — unlock/lock with specific key, custom messages
- [ ] `registerContainer(bus, objectId, options)` — open/close, exposes contents to scope on open
- [ ] `registerActor(bus, actorId, options)` — enter reaction, tick movement, attack response, talk handler
- [ ] `registerRoomEvent(bus, roomId, eventName, options)` — one-time or recurring room events with optional state effect
- [ ] `registerDaemon(bus, name, options)` — global tick listener with condition and effect (fuel, hunger, score)

### 3.7 Tests

- [ ] Before cancellation prevents state mutation
- [ ] Cancel reason is returned as feedback
- [ ] On listener mutates state correctly
- [ ] After listeners run in priority order
- [ ] `once: true` listener fires exactly once
- [ ] `take` before guard blocks non-carriable objects
- [ ] `unlock` before guard blocks wrong key
- [ ] `open` before guard blocks locked objects
- [ ] `registerLockable` factory: correct key unlocks, wrong key blocked
- [ ] `registerContainer` factory: contents appear in scope after open

---

## Phase 4 — Parser Layer

> **Goal:** Natural language input → validated `ParsedCommand` using an LLM with intent recognition.
> **Deliverable:** A reliable parser that handles synonyms, ambiguity, out-of-scope, and compound phrasing.

### 4.1 Command Schema

- [ ] `ParsedCommandSchema` as `z.discriminatedUnion` on `action`
  - `go` — direction (player navigation)
  - `move` — target (push/pull objects: "move the boulder", "push the crate")
  - `take` — target
  - `drop` — target
  - `examine` — target
  - `open` / `close` — target
  - `unlock` / `lock` — target, instrument (optional)
  - `attack` — target, instrument (optional)
  - `use` — target, instrument (optional)
  - `talk` — target, topic (optional)
  - `clarify` — question
  - `out_of_scope` — attempted
  - `meta` — command enum (save, load, quit, undo, help)

### 4.2 Parser Prompt

- [ ] System prompt template — role, available verbs, instructions for ambiguity and out-of-scope
- [ ] Context injection — room name, description, available exits, blocked exits, in_scope_objects with source tags
- [ ] Output format instructions — JSON only, no preamble
- [ ] Few-shot examples covering synonym variation, ambiguity, compound phrasing, out-of-scope

### 4.3 Parser Function

- [ ] `parse(world, state, input): Promise<ParsedCommand>`
  - builds context snapshot
  - calls LLM with intent recognition / JSON mode
  - validates response with `ParsedCommandSchema`
  - falls back to `clarify` on parse failure

### 4.4 Eval Dataset

- [ ] Happy path — one case per verb with canonical phrasing
- [ ] Synonym variation — 8-10 variants per verb
- [ ] Ambiguity — multiple valid targets, vague phrasing
- [ ] Out of scope — objects not in room, exits not available
- [ ] Compound phrasing — "use X on Y", "hit Z with W"
- [ ] Failure mode cases — intentionally vague input

### 4.5 Eval Runner

- [ ] Script to run full dataset against parser
- [ ] Reports accuracy per category
- [ ] Flags regressions against baseline
- [ ] Supports running against both prompt-based and tool-based approaches for comparison

### 4.6 Tests

- [ ] "go north" → `{ action: "go", direction: "north" }`
- [ ] "push the crate" → `{ action: "move", target: "crate" }`
- [ ] "grab the sword" → `{ action: "take", target: "sword" }`
- [ ] "unlock door with key" → `{ action: "unlock", target: "door", instrument: "key" }`
- [ ] "attack" with two actors in scope → `{ action: "clarify", question: "..." }`
- [ ] "take dragon" with no dragon in scope → `{ action: "out_of_scope", attempted: "dragon" }`
- [ ] Malformed LLM response → falls back to `clarify`

---

## Phase 5 — Narrative Layer

> **Goal:** Convert action results into prose, using authored responses first and the LLM narrator as fallback.
> **Deliverable:** A narrator that produces consistent, state-aware prose and never contradicts game state.

### 5.1 Feedback Resolution

- [ ] Check `event.params.feedback` first (authored `on_action` response)
- [ ] Fall through to LLM narrator if null

### 5.2 Narrator Prompt

- [ ] System prompt — role as narrator, tone instructions, state-consistency rules
- [ ] Context injection — room name, current description, action taken, result (success/failure), relevant object states
- [ ] Instructions to never mention objects not in scope, never contradict state flags

### 5.3 Narrator Function

- [ ] `narrate(world, state, command, feedback): Promise<string>`
  - returns authored feedback directly if present
  - otherwise calls LLM narrator with full context
- [ ] Room description on first visit vs revisit
- [ ] Inventory listing format

### 5.4 Narrator Evals

- [ ] Factual consistency checks — narrator doesn't mention taken objects, doesn't describe open room as dark
- [ ] LLM-as-judge quality scoring for prose variety and tone
- [ ] Regression suite for state-contradicting responses

### 5.5 Tests

- [ ] Authored feedback returned without LLM call
- [ ] Narrator receives correct state after mutation
- [ ] Room description uses `visited` variant on second entry
- [ ] Dark room description used when `dark` flag is true

---

## Phase 6 — Game Loop

> **Goal:** Wire all layers together into a working turn-based loop.
> **Deliverable:** A playable engine that accepts input and returns narrative, with undo and save/load.

### 6.1 Engine Bootstrap

- [ ] `createEngine(world, behaviourModule)` — builds state, creates bus, registers core listeners, registers world behaviours
- [ ] `registerCoreListeners(bus)` — all Phase 3.4 / 3.5 listeners
- [ ] `registerWorldListeners(bus, world)` — behaviour factories from world's behaviour module

### 6.2 Turn Function

- [ ] `turn(engine, input): Promise<{ narrative, newState }>`
  - parse input → `ParsedCommand`
  - handle meta commands (save, load, quit, undo) without touching game state
  - handle `clarify` and `out_of_scope` without event bus
  - handle `go` as `exit` + `enter` pair
  - handle all other commands via `executeAction`
  - run `tick` event at end of every turn
  - call `ensureVisited` on new room
  - call `narrate` with result

### 6.3 Undo

- [ ] State stack — push state before each turn
- [ ] `undo(engine)` — pops and restores previous state
- [ ] Cap stack depth (e.g. 20 turns) to manage memory

### 6.4 Meta Commands

- [ ] `save` — serialise current state to `SaveFile`
- [ ] `load` — restore state from `SaveFile`
- [ ] `quit` — emit `game:end` event, clean up
- [ ] `undo` — pop state stack
- [ ] `help` — return static help text

### 6.5 Tests

- [ ] Full turn produces new state and narrative
- [ ] Undo restores previous state exactly
- [ ] Save → load → turn produces same result as uninterrupted play
- [ ] `game:start` event fires on engine creation
- [ ] `game:end` event fires on quit
- [ ] Meta commands don't push to undo stack

---

## Phase 7 — Test Game (The Forgotten Manor)

> **Goal:** Validate the full engine end-to-end with a real playable game.
> **Deliverable:** A completable game that exercises every engine feature.

### 7.1 World Definition

- [ ] 4 rooms — Entrance Hall, Library, Garden, Study
- [ ] 13 objects — painting, compartment, brass_key, library_door, journal, study_key, study_door, bookshelf, stone_bench, fountain, oak_desk, candle, study_key
- [ ] All exits with conditions defined
- [ ] All descriptions with state variants

### 7.2 Behaviour Module

- [ ] `registerLockable` for library_door (brass_key) and study_door (study_key)
- [ ] `registerContainer` for compartment
- [ ] Custom listener: examining painting reveals compartment
- [ ] Custom listener: reading journal reveals study_key
- [ ] Custom listener: examining oak_desk sets `won: true`
- [ ] Win condition check in `tick` after listener

### 7.3 Puzzle Chain Walkthrough Test

Automated test that plays through the full solution:

- [ ] `examine painting` → compartment discovered
- [ ] `open compartment` → brass_key in scope
- [ ] `take brass key` → in inventory
- [ ] `unlock door with brass key` → library_door unlocked
- [ ] `open door` → library_door open
- [ ] `go north` → player in library
- [ ] `read journal` → study_key revealed
- [ ] `take iron key` → in inventory
- [ ] `unlock narrow door with iron key` → study_door unlocked
- [ ] `open narrow door` → study_door open
- [ ] `go east` → player in study
- [ ] `examine desk` → `won: true`

### 7.4 Parser Eval Run

- [ ] Run full eval dataset against Forgotten Manor context
- [ ] All happy path cases pass
- [ ] Synonym variation accuracy ≥ 90%
- [ ] Zero out-of-scope hallucinations

---

## Phase 8 — Extension Patterns (Zork-level Complexity)

> **Goal:** Validate that the architecture handles advanced IF features without structural changes.
> **Deliverable:** Reference implementations of common Zork-level patterns as reusable modules.

### 8.1 Darkness and Light

- [ ] `dark` flag on room state
- [ ] `buildParserContext` returns empty `in_scope_objects` when room is dark and no light source carried
- [ ] Light source object with `lit` state flag
- [ ] `registerLightSource(bus, objectId)` factory

### 8.2 actor Scheduling

- [ ] `tick` after listener for actor patrol movement between rooms
- [ ] actor enters/exits room scope correctly as position changes
- [ ] actor blocks exit in `go` before listener

### 8.3 Daemons (Global Tick Listeners)

- [ ] `registerDaemon(bus, name, { condition, effect, message })` factory
- [ ] Lantern fuel daemon — decrements fuel, warns at low fuel, extinguishes at zero
- [ ] Hunger daemon — increments hunger counter, warns, eventually kills player
- [ ] Scoring daemon — awards points on state flag changes

### 8.4 Nested Containers

- [ ] Objects inside closed containers excluded from scope
- [ ] Objects inside open containers appear in scope as `source: "container"`
- [ ] `take` from container removes from container's contains list
- [ ] Container weight limits (optional)

### 8.5 Conversation Trees

- [ ] Dialogue sub-state pushed onto stack when `talk` fires
- [ ] Parser context switches to dialogue mode — in_scope_objects replaced with topic options
- [ ] Dialogue state popped when conversation ends
- [ ] actor remembers conversation history via state flags

---

## File Structure

```
src/
  engine/
    state/
      schemas.ts          # All Zod schemas and inferred types (no location on GameObjectSchema)
      buildInitialState.ts
      save.ts
    world/
      mutators.ts         # isInRoom, isInInventory, moveObject*, setState, movePlayer etc.
      conditions.ts       # evaluateCondition
      descriptions.ts     # resolveRoomDescription, resolveObjectDescription
      parserContext.ts    # buildParserContext
    rules/
      eventBus.ts         # EventBus class
      executor.ts         # executeAction
      coreListeners.ts    # registerCoreListeners
      factories/
        lockable.ts
        container.ts
        actor.ts
        daemon.ts
        roomEvent.ts
    parser/
      schema.ts           # ParsedCommandSchema
      prompt.ts           # prompt template builder
      parse.ts            # parse() function
    narrator/
      prompt.ts           # narrator prompt builder
      narrate.ts          # narrate() function
    loop/
      engine.ts           # createEngine, turn, undo
      meta.ts             # handleMeta

  games/
    forgotten-manor/
      world.ts            # world definition (pure data)
      behaviours.ts       # event listener registrations

  evals/
    parser/
      dataset.ts          # eval test cases
      runner.ts           # eval runner script
    narrator/
      dataset.ts
      runner.ts
```

---

## Implementation Order

Each phase depends on the one before it. Within a phase, tackle items in the order listed.

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                                  ↓
                 Phase 6 ← Phase 5
                    ↓
                 Phase 7
                    ↓
                 Phase 8
```

Phases 4 and 5 can be developed in parallel once Phase 3 is complete, since they are both consumers of the rules layer but independent of each other.

---

## Definition of Done

The engine is considered complete for Phase 7 when:

- The Forgotten Manor puzzle chain walkthrough test passes end-to-end
- Parser eval accuracy ≥ 90% across all categories
- Save → load → continue works correctly
- Undo works for at least 10 turns
- No state mutations on cancelled actions
- Narrator never contradicts object state in automated consistency checks
