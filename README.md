# AIIFE: AI Interactive Fiction Engine

[![Tests](https://img.shields.io/badge/tests-239%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()
[![Node](https://img.shields.io/badge/Node.js-20%2B-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-purple.svg)]()

**AIIFE** is a modern, layered interactive fiction engine built in TypeScript. It blends the rock-solid determinism of classic text adventures (like Infocom's *Zork*) with a fast hybrid parser that uses LLMs for natural language intent recognition and seamless multilingual translation.

Unlike pure generative text games where the AI invents inconsistent lore on the fly, AIIFE enforces strict physical scope, state machines, and event-driven priority bands. **The engine is the arbiter of reality; the AI is your interface.**

---

## Highlights

- **⚡ Fast-Path Hybrid Parser**: Standard commands (`n`, `s`, `look`, `take lantern`, `i`, `save`, `undo`) execute in **< 1ms** with zero LLM API calls. Complex or conversational inputs are mapped to structured actions via LLM intent recognition.
- **🛡️ Priority-Banded Event Bus**: Five named priority bands (`GUARD`, `MUTATION`, `POST_MUTATION`, `EFFECT`, `DAEMON`) with scoped object preemption and `event.stop()` cancellation.
- **🎯 Single Source of Truth**: Entity-component-style object locations eliminate dual-inventory desync bugs.
- **🌍 Multilingual Narrator**: Handcrafted, deterministic IF prose in English with automatic on-the-fly streaming translation when players interact in another language.
- **⚔️ Battle-Tested on Zork I**: Ships with a full 110-room, 19-treasure, combat-ready recreation of *Zork I: The Great Underground Empire*, verified by 19 automated walkthrough integration tests.
- **📦 Authoring SDK**: Author games in clean TypeScript using `import { defineGame, registerAction } from "aiife/sdk"`.
- **💻 Modern Terminal UI**: Built with React and Ink, featuring interactive command history, arrow navigation, streaming text, animated spinners, and live token usage tracking.
- **💾 Pluggable Storage**: Multi-slot save/restore persistence (`FileSaveStorage` and `MemorySaveStorage`).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                Terminal UI (React + Ink)                │
└───────────────────────────┬─────────────────────────────┘
                            │ Player Input
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       GameAgent                         │
│  ┌──────────────────────┐     ┌──────────────────────┐  │
│  │   Fast-Path Parser   │-no-▶│ Intent Model (LLM)   │  │
│  │   Sub-ms Regex Match │     │ generateText + Zod   │  │
│  └──────────┬───────────┘     └──────────┬───────────┘  │
│             │ Match                      │ Structured   │
│             └─────────────┬──────────────┘ Intent       │
└───────────────────────────┼─────────────────────────────┘
                            │ RecognizedIntent
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      GameEngine                         │
│  - Target Scope Validation (isInScope / Ambient)        │
│  - Priority Event Bus (GUARD -> MUTATION -> EFFECT)     │
│  - Immutable State Transitions via Immer                │
│  - 50-turn Undo Stack & Save Slot Persistence           │
└───────────────────────────┼─────────────────────────────┘
                            │ Deterministic Feedback
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Narrator Layer                       │
│  - English: Pass-through (zero latency / zero cost)     │
│  - Multilingual: On-the-fly streamText translation      │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Requirements
- **Node.js 20 or newer**
- **npm**
- An API key for Anthropic, OpenAI, or Google Gemini (or a local Ollama server)

### Installation
```bash
git clone https://github.com/your-username/aiife.git
cd aiife
npm install
cp .env.example .env
```

Configure your model provider in `.env` (see [Model Configuration](#model-configuration)), then run the default game:

```bash
npm run dev
```

### Play Built-In Games
Pass the name of any game in `games/`:

```bash
# Play full 110-room Zork I
npm run dev -- zork-one

# Play the Troll Cave combat encounter
npm run dev -- troll

# Play The Great Hall (starter tutorial)
npm run dev -- the-great-hall

# Play The Forgotten Manor (pure JSON world definition)
npm run dev -- the-forgotten-manor
```

---

## Model Configuration

AIIFE supports **Anthropic**, **OpenAI**, **Google Gemini**, and **Ollama**. Configure providers in `.env`:

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

- `INTENT_PROVIDER`: Used for intent classification (fast/cheap models recommended).
- `NARRATOR_PROVIDER`: (Optional) Separate model used for multilingual translation. If omitted, intent provider config is reused.
- `LLM_TIMEOUT_MS`: Request timeout in milliseconds (default: 60,000).

---

## Creating Your Own Games

AIIFE provides a dedicated Authoring SDK exported from `"aiife/sdk"`.

Create a TypeScript file in `games/my-adventure.ts`:

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
  player: { current_room: "crypt_entrance", inventory: [], state: {} },
};

export default defineGame({
  world,
  setup(bus, registry) {
    // Custom verb recognized automatically by the LLM
    registerAction(bus, registry, "meditate", {
      schema: z.object({}),
      description: "meditate(): Meditate peacefully to focus your thoughts.",
      handler: (event, state) => {
        return "You close your eyes and breathe deeply. You feel at peace.";
      },
    });

    // Guard on gate
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

## Deep Dive Documentation

Explore the comprehensive technical guides in [`docs/`](docs/):

- 🏛️ [**Architecture Deep Dive**](docs/architecture.md) — Comprehensive breakdown of the 5 layers, state immutability, data lifecycle, and save/load persistence.
- 🛠️ [**Game Authoring Guide**](docs/authoring-guide.md) — Complete tutorial on rooms, objects, container nesting, locked doors, custom verbs, daemons, and automated testing.
- ⚡ [**Rules, Priorities & Event Bus**](docs/rules-and-events.md) — Technical reference on priority bands (`GUARD`, `MUTATION`, `POST_MUTATION`, `EFFECT`, `DAEMON`), scoped preemption, and core actions.
- 🧠 [**Hybrid Parser & Intent Recognition**](docs/parser-and-llm.md) — How the sub-ms fast-path parser, dynamic prompt construction, scope gatekeeping, and Laminar evals work.

---

## Engineering Blog Series

Read about the engineering decisions, failures, and breakthroughs along the way in [`docs/blog/`](docs/blog/):

1. 📝 [**Why We Stopped Letting the LLM Narrate: Lessons in Determinism**](docs/blog/01-why-we-stopped-letting-llms-narrate.md)  
   *Why freeform generative narration caused state hallucinations and latency, and why deterministic prose won.*

2. ⚙️ [**Rethinking the Event Bus: Why Before/On/After Failed and Priority Bands Won**](docs/blog/02-rethinking-the-event-bus.md)  
   *How complex puzzle interactions broke the classic 3-phase lifecycle and led to numerical priority bands and scoped preemption.*

3. 🏰 [**Rebuilding Zork I with Modern TypeScript, Priority Events, and LLMs**](docs/blog/03-rebuilding-zork-with-modern-typescript-and-llms.md)  
   *Porting 110 rooms, 19 treasures, combat, exorcisms, and flood gates to stress-test the AIIFE engine.*

---

## Development & Testing

```bash
# Run unit and integration tests (239 tests)
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

MIT © [Your Name / Team]
