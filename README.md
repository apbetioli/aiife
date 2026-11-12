# AIIFE: AI Interactive Fiction Engine

[![Tests](https://img.shields.io/badge/tests-248%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()
[![Node](https://img.shields.io/badge/Node.js-20%2B-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-purple.svg)]()

AIIFE is an interactive fiction engine written in TypeScript. It pairs the deterministic state model of text adventures with a hybrid parser that maps natural language input to structured game actions.

AIIFE enforces physical scope, state machines, and priority-banded events. The engine validates and runs game logic. The model handles natural language intent recognition and streaming translation.

---

## Features

- **Fast-path hybrid parser.** Common commands (`n`, `s`, `look`, `take lantern`, `i`, `save`, `undo`) run in under 1 ms without external network requests.
- **Priority-banded event bus.** Five named priority bands (`GUARD`, `MUTATION`, `POST_MUTATION`, `EFFECT`, `DAEMON`) support listener preemption and `event.stop()` cancellation.
- **Single source of truth.** Entity location fields track object placement without separate inventory arrays.
- **Multilingual narrator.** Handcrafted English prose passes directly to the terminal, and an LLM streams translations when players use other languages.
- **Verified Zork I implementation.** Ships with a 110-room, 19-treasure implementation of *Zork I: The Great Underground Empire*, verified by 19 automated integration tests.
- **Authoring SDK.** Game definitions import helpers directly from `aiife/sdk`.
- **Terminal UI.** React and Ink interface with command history, arrow navigation, streaming text, animated spinners, and live token usage tracking.
- **Pluggable storage.** Multi-slot save and restore persistence using `FileSaveStorage` and `MemorySaveStorage`.

---

## System architecture

```
┌─────────────────────────────────────────────────────────┐
│                Terminal UI (React + Ink)                │
└───────────────────────────┬─────────────────────────────┘
                            │ Player Input
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       GameAgent                         │
│  ┌──────────────────────┐     ┌──────────────────────┐  │
│  │   Fast-Path Parser   │-no-▶│ Scoped Tools (LLM)   │  │
│  │   Sub-ms Regex Match │     │ generateText + Tools │  │
│  └──────────┬───────────┘     └──────────┬───────────┘  │
│             │ Match                      │ Action       │
│             └─────────────┬──────────────┘ Tool Call    │
└───────────────────────────┼─────────────────────────────┘
                            │ RecognizedIntent
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      GameEngine                         │
│  - Target Scope Validation (isInScope, Ambient)         │
│  - Priority Event Bus (GUARD -> MUTATION -> EFFECT)     │
│  - Immutable State Transitions via Immer                │
│  - 50-turn Undo Stack and Save Slot Persistence         │
└───────────────────────────┼─────────────────────────────┘
                            │ Deterministic Feedback
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Narrator Layer                       │
│  - English: Pass-through (zero latency and zero cost)   │
│  - Multilingual: On-the-fly streamText translation      │
└─────────────────────────────────────────────────────────┘
```

---

## Quick start

### Requirements
- Node.js 20 or newer
- npm
- An API key for Anthropic, OpenAI, or Google Gemini, or a local Ollama server

### Installation
```bash
git clone https://github.com/your-username/aiife.git
cd aiife
npm install
cp .env.example .env
```

Configure your model provider in `.env` (see [Model configuration](#model-configuration)), then start the default game:

```bash
npm run dev
```

### Play built-in games
Pass the name of any game directory in `games/`:

```bash
# Play full 110-room Zork I
npm run dev -- zork-one

# Play the Troll Cave encounter
npm run dev -- troll

# Play The Great Hall tutorial
npm run dev -- the-great-hall

# Play The Forgotten Manor
npm run dev -- the-forgotten-manor
```

---

## Model configuration

AIIFE supports Anthropic, OpenAI, Google Gemini, and Ollama. Configure providers in `.env`:

```dotenv
# Provider: anthropic | openai | google | ollama
INTENT_PROVIDER=anthropic

# Anthropic
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# OpenAI
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-key
GOOGLEAI_MODEL=gemini-2.5-flash

# Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
```

- `INTENT_PROVIDER`: Provider used for intent recognition. Fast models work best here.
- `NARRATOR_PROVIDER`: Optional provider for multilingual translation. If omitted, the intent provider is used.
- `LLM_TIMEOUT_MS`: Request timeout in milliseconds (default: 60000).

---

## Authoring a game

AIIFE exports an authoring SDK from `aiife/sdk`.

Create a game file in `games/my-adventure.ts`:

```ts
import { defineGame, PRIORITY, registerAction, setObjectState, type World } from "../src/sdk";
import { z } from "zod";

const world: World = {
  id: "my_adventure",
  name: "The Crypt of the Moon",
  version: "1.0.0",
  start_room: "crypt_entrance",
  rooms: {
    crypt_entrance: {
      id: "crypt_entrance",
      name: "Crypt Entrance",
      descriptions: {
        default: "Ancient stone walls surround you. A heavy stone gate leads north.",
      },
      state: {},
      exits: {
        north: {
          leads_to: "inner_sanctum",
          condition: "stone_gate.open == true",
          locked_message: "The stone gate is shut tightly.",
        },
      },
    },
    inner_sanctum: {
      id: "inner_sanctum",
      name: "Inner Sanctum",
      descriptions: {
        default: "A grand chamber glowing with moonbeams. You have conquered the crypt!",
      },
      state: {},
      exits: { south: { leads_to: "crypt_entrance" } },
    },
  },
  objects: {
    stone_gate: {
      id: "stone_gate",
      name: "stone gate",
      aliases: ["gate", "door"],
      type: "door",
      location: "crypt_entrance",
      state: { carriable: false, open: false, locked: true },
      descriptions: { default: "A massive slab of granite." },
      requires_instrument: { unlock: "silver_sigil" },
    },
    silver_sigil: {
      id: "silver_sigil",
      name: "silver sigil",
      aliases: ["sigil", "key"],
      type: "key",
      location: "crypt_entrance",
      state: { carriable: true },
      descriptions: { default: "A polished silver disc depicting a crescent moon." },
    },
  },
  player: { current_room: "crypt_entrance", state: {} },
};

export default defineGame({
  world,
  setup(bus, registry) {
    registerAction(bus, registry, "meditate", {
      schema: z.object({}),
      description: "meditate(): Meditate peacefully to focus your thoughts.",
      handler: (event, state) => {
        return "You close your eyes and breathe deeply. You feel at peace.";
      },
    });

    bus.on("open", "stone_gate", (event, state) => {
      if (state.objects.stone_gate?.state.locked) {
        event.stop();
        return "The stone gate cannot be opened while its silver lock is engaged.";
      }
    }, { priority: PRIORITY.GUARD });
  },
});
```

Run your new game:
```bash
npm run dev -- my-adventure
```

---

## Documentation

Read the technical guides in [`docs/`](docs/):

- [Architecture](docs/architecture.md): The five engine layers, state immutability, data lifecycle, and storage persistence.
- [Authoring guide](docs/authoring-guide.md): Rooms, objects, container nesting, locked doors, custom verbs, daemons, and automated tests.
- [Rules, priorities, and events](docs/rules-and-events.md): Priority bands (`GUARD`, `MUTATION`, `POST_MUTATION`, `EFFECT`, `DAEMON`), scoped preemption, and core actions.
- [Parser and intent recognition](docs/parser-and-llm.md): Fast-path parser, dynamic prompt construction, scope validation, and evaluation setup.

---

## Engineering blog

Read about key architecture decisions in [`docs/blog/`](docs/blog/):

1. [Why we stopped letting the LLM narrate: lessons in determinism](docs/blog/01-why-we-stopped-letting-llms-narrate.md)
   Why freeform generative narration caused state drift and latency, and why deterministic prose solved both.

2. [Rethinking the event bus: why before, on, and after failed](docs/blog/02-rethinking-the-event-bus.md)
   How complex puzzle interactions broke three-phase lifecycles and led to numerical priority bands.

3. [Rebuilding Zork I with modern TypeScript, priority events, and LLMs](docs/blog/03-rebuilding-zork-with-modern-typescript-and-llms.md)
   Porting 110 rooms, 19 treasures, combat, exorcisms, and flood gates to test engine limits.

4. [Scoped tools vs. monolithic prompts: cutting token costs in LLM text parsers](docs/blog/04-scoped-tools-vs-prompt-baseline.md)
   Refactoring action prompts to dynamic tool calls, cutting prompt tokens by 18.3% across 85 benchmarked interactions.

---

## Development and testing

```bash
# Run unit and integration tests
npm test

# Watch tests during development
npm run test:watch

# Build the CLI and Authoring SDK with tsup
npm run build

# Check linting and formatting with Biome
npm run biome

# Run the Laminar intent evaluation suite
npm run eval
```

---

## License

MIT
