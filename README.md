# AI Interactive Fiction Engine

AIIFE is a terminal-based interactive fiction engine. You describe what you want to do in plain language; an LLM maps that input to a game action, the rules engine updates the world, and an LLM narrates the result. Game state and action rules are handled by the engine, so the model does not directly decide whether an action succeeds.

## Requirements

- Node.js 20 or newer
- npm
- An API key for Anthropic or OpenAI, or a running Ollama server

## Quick start

```bash
npm install
cp .env.example .env
```

Edit `.env` to select a model provider and add its API key. Then start the default game:

```bash
npm run dev
```

Pass a game name to play another built-in game:

```bash
npm run dev -- the-forgotten-manor
npm run dev -- zork
```

The default game is `the-great-hall`. Type commands such as “look around,” “take the key,” or “go north.” Type `quit` to exit.

## Model configuration

The intent parser and narrator use the same model configuration by default. Set `INTENT_PROVIDER` to `anthropic`, `openai`, or `ollama`. The `.env.example` file lists the available provider and model variables.

Example using Anthropic:

```dotenv
INTENT_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

Example using OpenAI:

```dotenv
INTENT_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o
```

Example using Ollama's OpenAI-compatible endpoint:

```dotenv
INTENT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
```

To use a separate narrator model, set `NARRATOR_PROVIDER` and its provider-specific model variable, such as `NARRATOR_PROVIDER=anthropic` and `NARRATOR_ANTHROPIC_MODEL=claude-sonnet-4-20250514`. If no narrator provider is set, the parser's model configuration is reused. `LLM_TIMEOUT_MS` controls the request timeout (default: 60 seconds).

## Built-in games

Game files live in `games/`. You can run a game by its filename without the extension. Available games include:

- `the-great-hall` (default)
- `the-forgotten-manor`
- `troll`
- `zork-one`
- `zork` (JSON world)

## Creating a game

Create a TypeScript module in `games/` that exports a default `World` object. The world describes rooms, exits, objects, object state, and starting inventory. `src/world/types.ts` defines the validated schema; `games/the-forgotten-manor.ts` is a compact example.

```ts
import type { World } from "../src/world/types";

const world: World = {
  id: "my_game",
  name: "My Game",
  version: "1.0.0",
  start_room: "start",
  rooms: {
    start: {
      id: "start",
      name: "Starting Room",
      descriptions: { default: "You are in a small room." },
      exits: {},
      contains: [],
    },
  },
  objects: {},
  player: { current_room: "start", inventory: [], state: {} },
};

export default world;
```

Run it with `npm run dev -- my-game`.

For custom action behavior, a TypeScript game module may also export `setup(bus, registry)`. It receives the event bus and action registry so the game can register listeners and actions. See `games/troll.ts` for an example.

## Development commands

```bash
npm run dev       # Run the default game
npm run watch     # Restart on source changes
npm run debug     # Run with model configuration diagnostics
npm test          # Run unit tests
npm run build     # Build the TypeScript package
npm run eval      # Run the Laminar evaluation suite
```

The evaluation suite and model comparison instructions are in [`evals/README.md`](evals/README.md). Set `LMNR_PROJECT_API_KEY` when using Laminar tracing or evaluations.

## How it works

1. The engine builds a parser context from the current room, visible objects, inventory, and available exits.
2. The intent model converts the player's input into a structured action and parameters.
3. The engine validates targets and runs the action through its event-driven rules.
4. The narrator turns the engine's feedback into a conversational response.

The engine includes core actions, extensible listeners, state validation, and save/load support. See `src/engine/` and `src/world/` for implementation details.
