# Scoped tools vs. monolithic prompts: cutting token costs in LLM text parsers

When building an AI-powered text adventure engine, intent recognition presents an early hurdle: how do you convert conversational player input (*"take that rusty sword and swing it at the troll"*) into a typed, deterministic game action?

Our initial architecture used a monolithic prompt baseline. We serialized every registered action, parameter schema, entity dictionary, and grammar rule into a single system prompt. We then asked the model to output a structured JSON intent.

For a three-room demo with five verbs, this approach works. As we rebuilt *Zork I* with 32 distinct actions, puzzle verbs (`exorcise`, `turn_bolt`, `pump`, `burn`, `tie`, `echo`), and 70 interactive objects, the monolithic prompt became inefficient.

A model should not evaluate parameter specifications for an exorcism ritual or floodgate mechanism when the player is opening a mailbox outside the house.

To address this, we redesigned our agent around dynamic scoped tool calling using the AI SDK. We then ran side-by-side evaluations across an 85-item test suite in Laminar.

This article details the transition and explains why scoped tools reduced prompt tokens by 18.3% while matching baseline accuracy.

---

## Limitations of monolithic action prompts

In our baseline architecture, every turn passed a serialized action dictionary to `generateText`:

```ts
// Monolithic baseline prompt (simplified)
const prompt = `You are an intent parser. Match the player's input to one of the registered actions:
- take(objects: [target_id])
- drop(objects: [target_id])
- open(objects: [target_id])
- pray()
- turn_bolt(objects: [bolt_id, wrench_id])
- pump(objects: [target_id, pump_id])
- exorcise(objects: [target_id, bell_id, book_id, candle_id])
... [25 more actions] ...

Available Objects in Scope:
- mailbox ("small mailbox")
- leaflet ("small leaflet")

Output valid JSON matching RecognizedIntentSchema.`;
```

This monolithic approach has three drawbacks:

1. **Linear token growth.** Every new action verb registered by a game author increases prompt size for every turn, regardless of player location.
2. **Context distraction.** Supplying dozens of unreachable verbs expands the search space and increases the likelihood of misclassification.
3. **Redundant schema definitions.** Action schemas had to be maintained for engine dispatch and formatted separately as prose descriptions in the system prompt.

---

## Refactoring to the AI SDK tool pattern

We aligned `ActionDefinition` directly with AI SDK function calling:

```ts
export interface ActionDefinition<TParams = unknown> {
  description: string;
  inputSchema: z.ZodType<TParams>;
  execute: (context: ActionContext, params: TParams) => Promise<ActionResult> | ActionResult;
  scopeFilter?: (context: ParserContext) => boolean;
}
```

The property `scopeFilter` filters the action registry dynamically against the current `ParserContext`:

```ts
export function buildScopedTools(
  registry: ActionRegistry,
  context: ParserContext
): Record<string, CoreTool> {
  const tools: Record<string, CoreTool> = {};

  for (const [name, def] of registry.getDefinitions()) {
    // Core verbs (look, take, drop, examine, go) are always available.
    // Puzzle verbs are exposed only if prerequisites or target objects are in scope.
    if (def.scopeFilter && !def.scopeFilter(context)) {
      continue;
    }

    tools[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
    });
  }

  // Supply conversational fallback
  tools.respond = tool({
    description: "Respond conversationally when the input is not a game action.",
    inputSchema: z.object({ message: z.string() }),
  });

  return tools;
}
```

### Strict schema enforcement
When running under strict JSON schema modes, optional fields cannot be omitted. Object properties must be explicitly specified and marked nullable:

```ts
// Rejected by strict schema validation:
slot: z.string().nullable().optional()

// Valid strict JSON schema:
slot: z.string().nullable()
```

---

## Aligning semantic flexibility

During initial evaluations, a discrepancy appeared:
- Input: `"open box"`
- Context: Room contains `wooden_crate`.
- Baseline prompt: Selected `open(objects: ["wooden_crate"])`.
- Scoped tools: Selected `respond("I can't open that.")`.

Why did the tool-calling model refuse to pick `open`?

The baseline prompt contained explicit heuristic rules:
- Semantic equivalents: "box" matches `crate`, "rug" matches `carpet`, "bottle" matches `glass_flask`.
- Compound words: "mail box" matches `mailbox`.

The initial tool-calling system prompt omitted these heuristics. The model noticed that `"box"` was not an exact substring of `"wooden_crate"` and selected `respond` instead of calling a tool with unverified arguments.

Porting semantic equivalency and compound substring heuristics into `buildToolSystemPrompt()` resolved the issue. Scoped tools matched the baseline's classification flexibility while retaining typed validation.

---

## Evaluation setup across 85 test cases

To test both executors across a realistic action space, we expanded the test suite:
1. Registered 17 custom Zork actions (`pray`, `ring_bell`, `exorcise`, `turn_bolt`, `pump`, `burn`, `tie`, `untie`, `echo`, `inflate`, `deflate`, `read_book`, `light`, `extinguish`, `attack`, `score`, `climb_down`).
2. Authored 34 Zork puzzle scenarios in `evals/intent-recognition/data/zork.json`.
3. Evaluated an 85-item dataset covering directional navigation, container manipulation, and multi-step puzzle interactions.

Both executors ran against the dataset with results recorded in Laminar.

---

## Empirical results

Evaluation metrics across 85 test items:

| Metric | [Scoped Tools](https://www.laminar.sh/project/470a2dca-b27e-4e44-83be-5b06ccc98b5e/evaluations/96ae65a2-1c43-4ee4-bf76-e8f27e914594) | [Prompt Baseline](https://www.laminar.sh/project/470a2dca-b27e-4e44-83be-5b06ccc98b5e/evaluations/73e877b0-5233-470b-9560-e8be77ec17c3) | Delta | Change |
| :--- | :--- | :--- | :--- | :--- |
| **Action selection accuracy** | **98.8%** (84/85) | **98.8%** (84/85) | `0.0%` | Identical |
| **Parameter accuracy** | **96.5%** (82/85) | **97.6%** (83/85) | `-1.1%` | Parity |
| **Combined evaluation score** | **97.9%** | **97.9%** | `0.0%` | Identical |
| **Total prompt tokens** | **98,752** | **120,863** | **-22,111** | **-18.3%** |
| *Average prompt tokens per turn* | *1,161.8* | *1,421.9* | *-260.1* | *-18.3%* |
| **Total completion tokens** | **15,880** | **18,820** | **-2,940** | **-15.6%** |
| *Average completion tokens per turn* | *186.8* | *221.4* | *-34.6* | *-15.6%* |
| **Total token count** | **114,632** | **139,683** | **-25,051** | **-17.9%** |
| **Average latency per turn** | **4.18s** | **4.28s** | *-0.10s* | Faster |

---

## Takeaways

1. **Token savings compound per session.** Pruning unreachable actions removed 260 prompt tokens on every turn. Across a 100-turn playthrough, this saves 26,000 tokens per session without reducing accuracy.
2. **Tool schemas provide parameter validation.** With monolithic prompts, models return raw JSON strings that require fallback validation. With the AI SDK's `tool({ inputSchema })`, Zod validates arguments before passing them to the engine.
3. **Dynamic tool scoping scales with game size.** As an adventure expands from 30 actions to 100 or more, monolithic prompt injection fails. Scoped tool calling bounds prompt size to immediate room and inventory context rather than total world size.
4. **Empirical benchmarking confirms token reduction.** Tracking runs in Laminar provided direct verification of token counts, latency distributions, and parameter accuracy.

---

## Conclusion

Scoped tools reduce prompt token consumption by 18% on natural language turns while providing strict parameter validation. Game authors define schemas once inside action definitions without maintaining separate prompt descriptions.
