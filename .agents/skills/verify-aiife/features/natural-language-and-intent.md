# Natural language and intent recognition

Natural language and intent recognition uses the LLM parser layer (`GameAgent`) when user inputs bypass the deterministic fast-path regex rules. The model extracts structured action tool calls (`go`, `take`, `examine`, `open`) bounded by in-scope objects and room directions, returning conversational responses for pure chatter.

## Sub-features

- `intent-synonym`: maps conversational phrasings (e.g. `head through the northern doorway`) to standard engine actions (`go north`).
- `intent-scoped-tools`: scopes LLM tool choices to currently visible objects and valid exits to prevent hallucinated interactions.
- `intent-chatter`: responds conversationally to questions or remarks without altering physical game state.
- `intent-multilingual`: translates deterministic IF responses into the player's language when addressed in a foreign language.

## How to get to it (user POV)

- Type non-standard directional commands (e.g. `walk into the library room`, `go through the door`).
- Type conversational interactions (e.g. `who are you?`, `what is this place?`).
- Type commands in another language (e.g. `regarde autour de toi`, `nimm die laterne`).

## Driving it with control-aiife

Preconditions:

- `control-aiife doctor` returns code 0.
- `.env` contains valid LLM API credentials (`INTENT_PROVIDER`, `ANTHROPIC_API_KEY`, etc.).
- Starting game is `the-great-hall`.

- **Natural language movement.** Use an un-patterned movement command. Run:
  `control-aiife drive --game the-great-hall --commands "walk into the northern corridor" --output-dir artifacts/verify-aiife/intent-movement`
  Observable result: LLM calls tool `go` with `{ direction: "north" }`. Room transitions to `The Library`.
- **Conversational chatter.** Talk to the Dungeon Master. Run:
  `control-aiife drive --game the-great-hall --commands "who are you?" --output-dir artifacts/verify-aiife/intent-chatter`
  Observable result: LLM agent responds conversationally as the Dungeon Master without invoking an invalid physical state mutation.
- **Multilingual translation.** Interact in another language (e.g. Spanish). Run:
  `control-aiife drive --game the-great-hall --commands "examinar el farol" --output-dir artifacts/verify-aiife/intent-spanish`
  Observable result: Engine recognizes `examine` action and translates the resulting prose into Spanish (`Un farol de latón robusto...`).

## Gotchas

- Natural language commands require network connectivity and valid LLM API keys. If the model API is unreachable or times out, the engine displays `The dungeon master had some urgent business to attend to.` (or stack trace if `DEBUG=true`).
- Fast-path regex commands (`n`, `s`, `look`, `take <item>`, `undo`, `save`) never hit the LLM. If you want to verify LLM intent recognition specifically, deliberately use natural language variations that do not match the fast-path regexes.
