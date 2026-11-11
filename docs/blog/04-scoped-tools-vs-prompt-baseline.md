# Scoped Tools vs. Monolithic Prompts: Slashing Token Costs in LLM Text Parsers

*By the AIIFE Engineering Team*

---

When building an AI-powered text adventure engine, one of the first design hurdles is **Intent Recognition**: how do you take a messy, conversational player input (*"take that rusty sword and swing it at the troll"*) and convert it into a strictly typed, deterministic game action?

Our initial architecture relied on what most developers start with: the **Prompt Baseline**. We took every registered action in the game, serialized their schemas, parameter expectations, entity dictionaries, and grammar rules, and dumped them into a single massive system prompt. We then asked the LLM to output a structured JSON intent.

For a tiny three-room demo with 5 verbs, this works fine. But as we rebuilt all of *Zork I*—scaling to **32 distinct actions**, dozens of complex puzzle verbs (`exorcise`, `turn_bolt`, `pump`, `burn`, `tie`, `echo`), and 70+ interactive objects—our monolithic prompt began to creak under its own weight.

Why should the LLM read the parameter specs for an exorcism ritual or a reservoir floodgate when the player is simply standing outside the White House opening a mailbox?

To fix this, we redesigned our agent around **Dynamic Scoped Tool Calling** using the Vercel AI SDK. We then ran side-by-side evaluations across an 85-item test suite tracked in Laminar.

Here is what we learned, how we solved edge cases, and why scoped tools cut prompt tokens by **18.3%** while maintaining matching accuracy.

---

## 1. The Monolithic Prompt Trap

In our baseline architecture, every turn passed a serialized action dictionary to `generateText`:

```ts
// The Monolithic Baseline Prompt (simplified)
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

This monolithic approach has three major drawbacks:

1. **Linear Token Inflation**: Every new action verb registered by a game author increases the prompt size for *every single turn*, regardless of where the player is located.
2. **Context Distraction**: Giving the model dozens of unreachable verbs increases the search space and can lead to bizarre misclassifications.
3. **Double Schema Maintenance**: Action schemas had to be maintained for game engine dispatch *and* formatted separately as prose descriptions in the system prompt.

---

## 2. Refactoring to the AI SDK Tool Pattern

We decided to align our `ActionDefinition` directly with modern AI SDK function calling:

```ts
export interface ActionDefinition<TParams = unknown> {
  description: string;
  inputSchema: z.ZodType<TParams>;
  execute: (context: ActionContext, params: TParams) => Promise<ActionResult> | ActionResult;
  scopeFilter?: (context: ParserContext) => boolean;
}
```

Notice the key addition: `scopeFilter`. Instead of sending all 32 tools to the model, our new `buildScopedTools` generator dynamically filters the action registry against the player's current `ParserContext`:

```ts
export function buildScopedTools(
  registry: ActionRegistry,
  context: ParserContext
): Record<string, CoreTool> {
  const tools: Record<string, CoreTool> = {};

  for (const [name, def] of registry.getDefinitions()) {
    // Core verbs (look, take, drop, examine, go) are always available.
    // Puzzle verbs are only exposed if their prerequisites or target objects are in scope!
    if (def.scopeFilter && !def.scopeFilter(context)) {
      continue;
    }

    tools[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
    });
  }

  // Always supply the conversational fallback
  tools.respond = tool({
    description: "Respond conversationally when the input is not a game action.",
    inputSchema: z.object({ message: z.string() }),
  });

  return tools;
}
```

### Strict Schema Enforcement
When transitioning to OpenAI's strict tool calling mode (`gpt-4.1-mini` and `gpt-5-mini`), we encountered strict JSON schema constraints. For example, optional fields cannot simply be omitted; all object properties must be explicitly specified and marked nullable:

```ts
// ❌ Rejected by OpenAI strict schema validation:
slot: z.string().nullable().optional()

// ✅ Valid strict JSON schema:
slot: z.string().nullable()
```

---

## 3. The "Open Box" Problem: Aligning Semantic Flexibility

During our initial evaluation, we noticed an unexpected discrepancy:
- Input: `"open box"`
- Context: Room contains `wooden_crate`.
- Baseline Prompt: Selected `open(objects: ["wooden_crate"])`.
- Scoped Tools: Selected `respond("I can't open that.")`.

Why did the tool-calling model refuse to pick `open`?

In our baseline prompt, we had spent weeks refining intent recognition instructions:
- *Semantic equivalents*: "box" matches `crate`, "rug" matches `carpet`, "bottle" matches `glass_flask`.
- *Compound words*: "mail box" matches `mailbox`.

The initial tool-calling system prompt, however, was overly terse: it simply declared *"You are a parser. Call tools."* The LLM, seeing that `"box"` was not an exact substring of `"wooden_crate"`, cautiously chose the `respond` tool rather than making an invalid parameter call.

By explicitly porting our semantic equivalency and compound substring heuristics into `buildToolSystemPrompt()`, the discrepancy vanished. Scoped tools matched the baseline's semantic flexibility while maintaining structured tool validation.

---

## 4. Scaling the Evaluation: 85 Zork Test Cases

To verify our hypothesis across a production-grade action space, we expanded our evaluation suite:
1. Registered all **17 custom Zork actions** (`pray`, `ring_bell`, `exorcise`, `turn_bolt`, `pump`, `burn`, `tie`, `untie`, `echo`, `inflate`, `deflate`, `read_book`, `light`, `extinguish`, `attack`, `score`, `climb_down`).
2. Authored **34 new real-world Zork puzzle cases** in `evals/intent-recognition/data/zork.json`.
3. Created an 85-item comprehensive evaluation dataset spanning standard navigation, container manipulation, and multi-step Infocom puzzle rituals.

We ran both executors against the dataset, tagged them cleanly in Laminar, and extracted span-level telemetry via SQL.

---

## 5. The Empirical Results

Here are the side-by-side results across 85 evaluation items:

| Metric | [Scoped Tools](https://www.laminar.sh/project/470a2dca-b27e-4e44-83be-5b06ccc98b5e/evaluations/96ae65a2-1c43-4ee4-bf76-e8f27e914594) | [Prompt Baseline](https://www.laminar.sh/project/470a2dca-b27e-4e44-83be-5b06ccc98b5e/evaluations/73e877b0-5233-470b-9560-e8be77ec17c3) | Difference | Change |
| :--- | :--- | :--- | :--- | :--- |
| **Action Selection Accuracy** | **98.8%** (84/85) | **98.8%** (84/85) | `0.0%` | Identical |
| **Parameter Accuracy** | **96.5%** (82/85) | **97.6%** (83/85) | `-1.1%` | Parity |
| **Combined Eval Score** | **97.9%** | **97.9%** | `0.0%` | Identical |
| **Total Input (Prompt) Tokens** | **98,752** | **120,863** | **-22,111** | **-18.3%** |
| *Avg Input Tokens / Turn* | *1,161.8* | *1,421.9* | *-260.1* | *-18.3%* |
| **Total Output (Completion) Tokens** | **15,880** | **18,820** | **-2,940** | **-15.6%** |
| *Avg Output Tokens / Turn* | *186.8* | *221.4* | *-34.6* | *-15.6%* |
| **Grand Total Tokens** | **114,632** | **139,683** | **-25,051** | **-17.9%** |
| **Average Latency / Turn** | **4.18s** | **4.28s** | *-0.10s* | Faster |

---

## 6. Key Takeaways

### 1. Saving 260 Tokens Per Turn Compounds Rapidly
By pruning irrelevant actions before calling the LLM, we shaved **260 input tokens off every single turn**. In an interactive fiction game where a player typically takes 50–100 turns per session, this eliminates **13,000 to 26,000 tokens** per walkthrough with zero degradation in accuracy.

### 2. Native Tool Calling Provides Built-In Validation
With the monolithic prompt, the LLM returned raw JSON strings that occasionally had subtle parsing or formatting defects. With AI SDK's `tool({ inputSchema })`, parameter validation is guaranteed by Zod before the handler is ever invoked.

### 3. Dynamic Tool Scoping is Essential for Large Action Spaces
As games grow from 30 verbs to 100+ verbs (or when building RPGs with hundreds of spell and ability combinations), monolithic prompt injection breaks down entirely. Scoped tool calling keeps the prompt bounded to $O(\text{context})$ rather than $O(\text{world})$.

### 4. Continuous Observability is a Game Changer
Having Laminar integrated into our development workflow transformed this from a speculative discussion into an empirical conclusion. We didn't have to guess whether tool calling was cheaper or more accurate—we ran the eval, inspected the traces, and checked the token delta directly.

---

## Conclusion

For the player:
The game consumes approximately 18% fewer prompt tokens per turn on complex natural language inputs. Response latency is reduced, and tool-driven parameter validation prevents malformed action commands.
  
For the maintainer:
Game authors only define inputSchema once when registering an action. Authors no longer need to update monolithic intent prompts, global intent schemas, or metadata tables when adding verbs.

## What's Next?

With scoped tools proven and benchmarked, our next phase will connect the dynamic tool builder directly into the runtime `GameAgent` loop, allowing players to play through *Zork I* with faster response times and significantly reduced inference costs.
