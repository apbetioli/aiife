# Why we stopped letting the LLM narrate: lessons in determinism for interactive fiction

When developers combine language models with text adventures, the initial design often assumes the model should generate narrative on every turn:

> "The model will be the ultimate dungeon master. It will dynamically describe the world, react to player ideas with emergent storytelling, and paint vivid scenes that static engines cannot match."

We started there too.

Our initial implementation had a narrative layer that fed the current game state, the player's action, and the engine result into an LLM prompt on every turn.

Within two weeks of testing, we discarded the generative narrator. Here is why generative narration failed, what broke, and why making the text adventure engine deterministic produced a better game.

---

## The 1,500 ms latency cost on simple actions

Interactive fiction relies on a tight feedback loop. When a player types `n`, `take lamp`, or `open door`, they expect an immediate confirmation:

```
> take lamp
Taken.
```

When every turn requires a model invocation:
1. The engine computes the state mutation in under 1 ms.
2. The agent serializes state and sends a prompt to the model.
3. The client waits 800 ms to 2,000 ms for the stream to complete.
4. The output arrives: *"You reach down with both hands, grasping the smooth brass handle of the antique lantern. As your fingers curl around the cool metal, you lift it from the pedestal and tuck it securely beneath your arm."*

After five turns, this verbosity slows gameplay down. In classic text adventures, purple prose adds friction. Players want immediate feedback so they can focus on solving puzzles and mapping rooms.

---

## Hallucinations in physical puzzle spaces

Interactive fiction requires physical precision. If a room has three exits (north, south, and east) and a locked oak door, the player's mental model depends on those exact facts.

When a model generates narrative freely, subtle contradictions emerge:
- The engine marks an iron chest as closed and locked. The model writes: *"The lid of the chest sits slightly ajar, glistening with a faint golden light inside."* The player attempts to grab the gold inside and receives an engine rejection: *"The chest is closed."*
- The player drops a sword in Room A and moves to Room B. The model, reading the sword in previous turns, continues describing the player *"loosening the scabbard at your hip."*
- In dark rooms, the model invents visual features ("*shadowy silhouettes dance across the cavern walls*") even when game rules require a light source to see anything.

Prompt constraints ("*never mention objects not in scope*", "*never describe open containers unless open is true*") reduced hallucinations but still failed intermittently. In a puzzle game where state must remain exact, occasional hallucinations break player trust.

---

## The solution: deterministic output and translation

Authored text adventure prose is already concise and mechanically accurate. We restructured our architecture around two principles:

### 1. The engine produces output
When a player executes an action in English, the engine returns authored text directly:
- Room descriptions come directly from authored definitions.
- Actions produce canonical interactive fiction messages (*"Taken."*, *"Closed."*, *"It's locked."*, *"You can't go that way."*).
- Puzzle results come from author-defined event listeners.

This path requires zero network requests, incurs zero token costs, and runs in under 1 ms.

### 2. The model handles intent recognition and translation
Language models excel at two tasks in interactive fiction:
1. **Intent recognition.** Mapping conversational phrasing, typos, and synonyms to structured commands (*"grab that shiny lantern on the table"* $\rightarrow$ `{ action: "take", objects: ["brass_lantern"] }`).
2. **Translation.** When a player inputs commands in Spanish (*"recoge la lámpara de latón"*), the engine recognizes the intent, performs the state mutation, and the narrator model translates the English output into Spanish while preserving formatting and line breaks.

```ts
export const NARRATION_SYSTEM_PROMPT = `You are the narrator for a text adventure game.
Your ONLY job is to output the game text below. Do not reason about it, question it, or add commentary.

Rules:
- If the player writes in a non-English language, translate the game output into that language.
- If the player uses English, output the game text exactly as-is, word for word.
- If the game output is empty or exactly "Done.", output a single brief past-tense confirmation.
`;
```

---

## Conclusion

Language models work well for interpreting varied user inputs and translating output across languages. For physical simulation, rules, and state consistency, deterministic code remains the right tool.

Separating intent recognition from narrative output gives AIIFE natural language input flexibility alongside the consistency of classic adventure engines.
