# Hybrid parsing and intent recognition

AIIFE translates player text into structured game actions through a two-stage parsing pipeline.

Text adventure players expect single-letter navigation (`n`, `s`, `look`) to execute with zero latency. At the same time, players also submit complex natural language phrasing like "use the brass key to unlock the oak chest". 

AIIFE resolves this tension by placing a sub-millisecond regular expression matcher ahead of the language model. When the input matches standard interactive fiction grammar, the engine handles it immediately. When the input contains descriptive phrasing or conversational queries, the engine forwards the turn to the model.

---

## Parser design trade-offs

| Requirement | Regular expression parser | Pure generative model | AIIFE hybrid model |
| :--- | :--- | :--- | :--- |
| Common commands (`n`, `i`, `look`) | Fast (under 1 ms), free | Slow (500 ms to 2,000 ms), high token cost | Under 1 ms, zero API cost |
| Synonym handling | Fails on unmapped phrasing | High accuracy | High accuracy |
| Multi-word phrasing | Requires complex grammar trees | High accuracy | High accuracy |
| State consistency | Fully deterministic | Can hallucinate items or outcomes | Validated target scope and deterministic engine state |

---

## Parsing pipeline

### 1. Fast-path parser
The function `tryDeterministicIntent` in `src/agent/fast-path-parser.ts` evaluates player text before the engine initiates an API request:

1. **Directional abbreviations.** `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`, `u`, `d`, `in`, and `out` map directly to `{ action: "go", direction: "..." }`.
2. **Standard single-word actions.**
   - `l` and `look` map to `{ action: "look" }`.
   - `i`, `inv`, and `inventory` map to `{ action: "inventory" }`.
   - `undo` maps to `{ action: "undo" }`.
   - `save [slot]` maps to `{ action: "save", slot: "..." }`.
   - `restore [slot]` maps to `{ action: "restore", slot: "..." }`.
   - `q` and `quit` map to `{ action: "quit" }`.
   - `help` maps to `{ action: "help" }`.
3. **Simple verb-noun patterns.**
   - `take <target>` and `get <target>` map to `{ action: "take", objects: ["<target>"] }`.
   - `drop <target>` maps to `{ action: "drop", objects: ["<target>"] }`.
   - `x <target>` and `examine <target>` map to `{ action: "examine", objects: ["<target>"] }`.

When a pattern matches, the turn executes without network overhead.

---

### 2. Scoped tool calling
When the fast-path parser finds no match, `GameAgent` delegates parsing to the model with AI SDK tool calling:

1. **Parser context snapshot (`buildParserContext`).**
   - Current room name and description.
   - Available unblocked exits.
   - Strictly in-scope objects (items in the room, items in inventory, and contents of open containers).
   - Known aliases for objects.
2. **Action scoping (`evaluateActionScope`).**
   - The engine checks whether the player meets prerequisites for contextual actions.
   - Irrelevant tools are pruned from the schema before dispatching the request.
   - Each tool exposes its parameter requirements through a Zod schema.

The model selects the matching tool, populates arguments from the player input, or calls `respond` for conversational questions.

---

### 3. Physical scope validation
Before dispatching an action to `EventBus`, the engine validates target accessibility:

```ts
function allTargetsInScope(state: GameState, params: Record<string, unknown>): boolean
```

If the model extracts `action: "take", objects: ["golden_chalice"]`, the engine verifies that `golden_chalice` is in the room, in inventory, or inside an open container. If the item is not reachable, the engine halts execution and returns:

> "You don't see that here."

This check prevents state hallucinations and actions on out-of-scope targets.

---

## Streaming translation layer

The narrator prompt translates text without inventing narrative facts:

1. **English input.** When the engine produces feedback in English, the UI renders the text directly.
2. **Multilingual input.** When player input contains non-English text, `streamText` translates the engine's exact output into the player's language while preserving formatting and line breaks.
3. **Conversational queries.** When the player asks out-of-character questions, the `respond` tool returns conversational text without mutating game state.

---

## Evaluation

The repository contains an automated evaluation suite that measures intent classification accuracy and latency across models. For instructions on running evals with Laminar, read [Evaluating model performance](../evals/README.md).
