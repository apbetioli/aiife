# Why We Stopped Letting the LLM Narrate: Lessons in Determinism for Interactive Fiction

*By the AIIFE Engineering Team*

---

When developers first consider combining Large Language Models with text adventures, the mental model almost always looks like this:

> *"The LLM will be the ultimate Dungeon Master. It will dynamically describe the world, react to any wacky player idea with rich, emergent storytelling, and paint vivid scenes that no static game engine ever could."*

We started there, too. 

Our original implementation plan had a dedicated **Narrative Layer** designed to take the game state, the player's action, and the engine result, and feed them into an LLM prompt to synthesize fresh prose on every turn.

**Within two weeks of testing, we scrapped it completely.**

Here is the story of why generative narration failed, what broke, and why making our text adventure engine deterministic was the best design decision we made.

---

## 1. The 1,500ms Tax on "Take Lamp"

Interactive fiction has a very distinct rhythm. When a player types `n`, `take lamp`, or `open door`, they expect an instantaneous confirmation:

```
> take lamp
Taken.
```

When every turn requires an LLM call to narrate the result:
1. The engine computes the state mutation in **< 1ms**.
2. We serialize state and prompt an LLM.
3. We wait **800ms to 2,000ms** for the stream to begin and finish.
4. The output arrives: *"You reach down with both hands, grasping the smooth brass handle of the antique lantern. As your fingers curl around the cool metal, you lift it from the pedestal and tuck it securely beneath your arm."*

After the fifth turn, this feels agonizingly slow. For classic text adventures, verbose purple prose is not immersion—it is friction. Players want punchy, immediate feedback so they can focus on solving puzzles and mapping the dungeon.

---

## 2. The Hallucination Creep

Interactive fiction relies on **absolute physical precision**. If a room has three exits (north, south, east) and a locked oak door, the player's mental model depends on those exact facts.

When an LLM is asked to freely generate narrative descriptions, subtle contradictions inevitably creep in:
- The engine reports that an iron chest is closed and locked. The LLM describes: *"The lid of the chest sits slightly ajar, glistening with a faint golden light inside."* The player immediately attempts to grab the gold inside and is hit with: *"The chest is closed."*
- The player drops a sword in Room A and moves to Room B. The LLM, seeing the sword in recent chat history, continues describing the player *"loosening the scabbard at your hip."*
- In dark rooms, the LLM hallucinates visual features ("*shadowy silhouettes dance across the cavern walls*") when the game rules dictate that the player cannot see anything without a light source.

Attempting to constrain the LLM with ever-longer system prompts ("*NEVER mention objects not in scope*", "*NEVER describe open containers unless open is true*") created a fragile prompt engineering nightmare that still failed 2% of the time. In a puzzle game, a 2% hallucination rate breaks the game.

---

## 3. The Pivot: Engine Determinism + Multilingual Bridge

We realized that classic Interactive Fiction prose—whether Infocom's sharp, evocative descriptions or custom author lines—is already great. It is handcrafted, punchy, and mechanically accurate.

We changed our architecture around two core principles:

### A. The Engine Owns the Output
When a player executes an action in English, the engine produces deterministic feedback directly:
- Room descriptions come straight from authored definitions.
- Actions produce canonical IF responses (*"Taken."*, *"Closed."*, *"It's locked."*, *"You can't go that way."*).
- Custom puzzle results are defined directly by game authors.

Zero LLM calls. Zero token costs. Sub-millisecond turn latency.

### B. The LLM is an Intent Translator and Multilingual Bridge
Where do LLMs actually shine in interactive fiction?
1. **Intent Recognition**: Understanding what the player meant, regardless of synonyms, typos, or conversational framing (*"grab that shiny lantern on the table"* $\rightarrow$ `{ action: "take", objects: ["brass_lantern"] }`).
2. **Language Translation**: If a player inputs commands in Spanish (*"recoge la lámpara de latón"*), the engine recognizes the intent, performs the deterministic mutation, and the narrator model translates the authored English output back into fluent Spanish while preserving formatting and line breaks.

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

Generative AI is revolutionary when used to decode messy human intent and break down language barriers. But for simulation, rules, physics, and state consistency, traditional deterministic code remains unbeaten.

By stripping the LLM of narrative license and giving full narrative authority back to the engine, AIIFE achieved the best of both worlds: the infinite flexibility of natural language input with the rock-solid reliability of an Infocom classic.
