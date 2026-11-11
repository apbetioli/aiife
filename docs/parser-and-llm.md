# Hybrid Parser, LLM & Intent Recognition

AIIFE bridges natural language input and strict, deterministic game execution through a **hybrid parser architecture**.

Rather than relying purely on an LLM for all text processing or falling back to rigid 1980s regexes, AIIFE blends both: a sub-millisecond fast-path parser for canonical commands, paired with an LLM intent recognizer dynamically grounded in game state.

---

## 1. Why a Hybrid Approach?

| Requirement | Pure Regex / Verb-Noun Parser | Pure LLM Generative Parser | AIIFE Hybrid Model |
| :--- | :--- | :--- | :--- |
| **Common commands (`n`, `i`, `look`)** | Fast (<1ms), free | Slow (500ms–2000ms), high API cost | **Instant (<1ms), zero API cost** |
| **Natural language variations** | Fails easily on synonyms | High understanding | **High understanding** |
| **Complex phrasing ("use brass key to unlock chest")** | Requires complex grammar trees | High understanding | **High understanding** |
| **State integrity & hallucinations** | Deterministic | Can hallucinate items or outcomes | **Strict scope validation & deterministic state** |

---

## 2. Component Walkthrough

### 2.1 Fast-Path Parser (`tryDeterministicIntent`)
Located in `src/agent/fast-path-parser.ts`, this component evaluates player input before touching an LLM:

1. **Directional abbreviations**: `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`, `u`, `d`, `in`, `out` $\rightarrow$ `{ action: "go", direction: "..." }`.
2. **Standard actions**:
   - `l`, `look` $\rightarrow$ `{ action: "look" }`
   - `i`, `inv`, `inventory` $\rightarrow$ `{ action: "inventory" }`
   - `undo` $\rightarrow$ `{ action: "undo" }`
   - `save [slot]` $\rightarrow$ `{ action: "save", slot: "..." }`
   - `restore [slot]` $\rightarrow$ `{ action: "restore", slot: "..." }`
   - `q`, `quit` $\rightarrow$ `{ action: "quit" }`
   - `help` $\rightarrow$ `{ action: "help" }`
3. **Simple verb-noun regexes**:
   - `take <target>`, `get <target>` $\rightarrow$ `{ action: "take", objects: ["<target>"] }`
   - `drop <target>` $\rightarrow$ `{ action: "drop", objects: ["<target>"] }`
   - `x <target>`, `examine <target>` $\rightarrow$ `{ action: "examine", objects: ["<target>"] }`

If the fast-path matches, the turn executes instantly with zero network latency.

---

### 2.2 Scoped Tools Builder (`buildScopedTools`)
When the fast-path does not match, the engine delegates to the LLM using AI SDK tool calling (`buildScopedTools`). Tools are dynamically scoped to the player's physical context:

1. **Parser Context Snapshot (`buildParserContext`)**:
   - Current room name and description.
   - Available (open) exits.
   - Strictly in-scope objects (room items + inventory items + visible open container contents).
   - Known aliases for objects.
2. **Action Registry Scoping (`evaluateActionScope`)**:
   - Puzzle verbs and contextual actions are filtered based on their `scope` rules.
   - Actions outside current room, inventory, or item prerequisites are pruned before calling the LLM.
   - Each tool exposes its individual `inputSchema` directly to the model.

The model selects the matching action tool, binds arguments according to the action's validated schema, or invokes `respond` for conversational queries.

---

### 2.3 Scope Gatekeeper
Before an action is dispatched to the event bus, the engine performs a critical validation:
```ts
function allTargetsInScope(state: GameState, params: Record<string, unknown>): boolean
```
Even if the LLM extracts `action: "take", objects: ["golden_chalice"]`, the engine checks whether `golden_chalice` is physically present in the room, carried, or inside an open container. If not, execution immediately stops and returns:
> *"You don't see that here."*

This completely prevents state hallucinations and "action telepathy."

---

## 3. The Multilingual Narrator Layer

In AIIFE, the narrator model (`NARRATION_SYSTEM_PROMPT`) does **not** invent narrative facts. It follows strict rules:

1. **English Input**: If the player enters input in English and the engine produces explicit feedback (such as descriptions or messages), the engine output is returned directly with zero LLM overhead.
2. **Multilingual Input**: If the player interacts in Spanish, French, Japanese, or any other language, the narrator model streams a faithful translation of the engine's exact feedback while preserving line breaks and formatting.
3. **Conversational Fallback**: If the player greets or asks off-topic questions, the `respond` intent delivers a natural conversational reply without modifying game state.

---

## 4. Evaluation Suite with Laminar

The intent parser is evaluated against hundreds of natural language examples in `evals/intent-recognition/`.

### Running Evals
```bash
export LMNR_PROJECT_API_KEY=your_key
npm run eval
```

### Comparing Models
You can benchmark accuracy and latency between different models using the `EVAL_MODEL` environment variable:

```bash
# Benchmark Claude
EVAL_MODEL=claude-3-5-haiku npm run eval

# Benchmark OpenAI
EVAL_MODEL=gpt-4o-mini npm run eval

# Benchmark Gemini
EVAL_MODEL=gemini-2.5-flash npm run eval
```

Results stream directly to the Laminar dashboard, displaying side-by-side accuracy, parameter matching, latency distributions, and token consumption.
