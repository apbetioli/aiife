---
name: verify-aiife
description: Launch, drive, and verify AIIFE (AI Interactive Fiction Engine) in an isolated terminal PTY session. Use when verifying room navigation, fast-path commands, inventory actions, save/restore persistence, undo history, or LLM-driven intent recognition.
---

# Verify AIIFE (AI Interactive Fiction Engine)

AIIFE is a hybrid interactive fiction engine and terminal UI built with React, Ink, and Node.js. It features deterministic fast-path actions (<1ms, 0 tokens) and an LLM-assisted parser for natural language inputs.

Because AIIFE is a terminal UI (TUI) requiring a raw pseudo-terminal (PTY) to capture keystrokes and render interactive frames, standard piped standard input (`echo ... | npm start`) fails with `ERROR Raw mode is not supported on the current process.stdin`. This verification harness drives the real application via an automated PTY controller (`control-aiife`).

## Launch

For AIIFE's terminal UI, there is no persistent background daemon or network port to keep alive. Launch means initializing the Node runtime with the `tsx` TypeScript loader inside an allocated pseudo-terminal:

```bash
# Direct command invoked by the PTY harness:
node --import tsx --env-file=.env src/index.ts [game-name]
```

Default game is `the-great-hall`. Additional built-in games include `zork-one`, `troll`, and `the-forgotten-manor`.

- **Ready indicator:** The app has reached a usable interactive state when the banner and prompt appear in the terminal stream:
  `🤖 Hi, I'm the Dungeon Master. (type "quit" to quit)`
  followed by the starting room description and the prompt `> ▌`.
- **Teardown:** Sending `quit\r` gracefully triggers Ink's exit handler, stopping the session and flushing terminal state.

## Doctor

Before attempting a verification drive, run the read-only doctor check:

```bash
.agents/skills/verify-aiife/bin/control-aiife doctor
```

Doctor validates:
1. **Node.js runtime:** Node >= 20 (required by Ink 6 and React 19).
2. **Dependencies:** `node_modules/` exists and `tsx` loader resolves cleanly.
3. **Environment:** `.env` exists in repo root with configured LLM providers (Anthropic, OpenAI, Google Gemini, or Ollama). Fast-path IF commands bypass the LLM, but the agent initializes with configured provider keys.
4. **Games registry:** Verifies presence of game definitions under `games/` (`the-great-hall.ts`, `zork-one.ts`, etc.).
5. **PTY allocation:** Verifies that OS pseudo-terminal (`pty`) pairs can be opened.

Doctor exits with code `0` if all checks pass, or code `1` with diagnostics if broken.

## Drive

Drive the application using the project-local harness helper:

```bash
.agents/skills/verify-aiife/bin/control-aiife drive \
  --game the-great-hall \
  --commands "look;north;take old book;save verify-session;quit" \
  --save-slot verify-session \
  --output-dir artifacts/verify-aiife/<run-id>
```

### Stable Interactive Handles

- **Prompt indicator:** `> ▌` (or prompt line ending in `>`).
- **User input echo:** `› <command>` emitted into Ink's static message list.
- **Engine priority events:** `⚡<action> <params-json>` (e.g. `⚡look {}`, `⚡go {"direction":"north"}`, `⚡take {"objects":["brass_lantern"]}`).
- **Game feedback:** Distinct narrative paragraphs describing rooms, items, or action confirmation (`Done.`, `Taken.`, `Game saved to slot "..."`).

### Input Timing Protocol

Ink's `Input` component uses React state to accumulate keystrokes. When driving programmatically:
1. Write the full command text into the PTY fd.
2. Allow a 300ms pause for React state to commit the input buffer.
3. Write `\r` (carriage return) to trigger Ink's `key.return` handler.
4. Wait for the `› <command>` confirmation and the return of the prompt cursor (`▌`).

## Evidence

Every verification drive captures and stores evidence under `artifacts/verify-aiife/<run-id>/`:

1. **`transcript.txt`**: Reconstructed, human-readable transcript of user inputs (`› <cmd>`), engine bus events (`⚡<event>`), and game narrative responses, free from ANSI cursor repositions and duplicate redraws.
2. **`transcript.raw.txt`**: Complete, bit-exact terminal byte stream including ANSI escape codes and Ink redraw frames.
3. **`session.json`**: Structured run metadata including timestamp, game name, command sequence, duration in seconds, process exit code, and artifact links.
4. **`save-state.json`** *(when save slot is tested)*: Direct copy of the serialized `.save-<world>-<slot>.json` state file created on disk by `FileSaveStorage`, proving exact player location (`current_room`), move count, and inventory state.

### Proof Standards

- **User entry:** Exercise commands through the terminal UI prompt as a player would, never through synthetic internal function calls.
- **Dual verification:** For state-changing commands (e.g. movement, item manipulation, save), verify both the terminal feedback (`The Library`, `Game saved to slot...`) and the persisted side effect (`save-state.json` room ID or inventory list).

## Cleanup

Cleanup removes disposable scratch state and temporary save files generated during verification runs, while **never** deleting proof artifacts in `artifacts/`:

```bash
.agents/skills/verify-aiife/bin/control-aiife cleanup
```

- Cleans up `.save-*-verify-*.json` and `.save-*-test*.json` files from the repository root.
- Ensures no orphaned Node child processes or dangling PTY file descriptors remain.
- All proof artifacts in `artifacts/verify-aiife/` remain untouched.

## Helpers

The harness helper script is located at:
`[control-aiife](file:///Users/alex/Code/alex/aiife/.agents/skills/verify-aiife/bin/control-aiife)`

### Usage

```bash
# 1. Check environment readiness
.agents/skills/verify-aiife/bin/control-aiife doctor

# 2. Drive an interactive scenario
.agents/skills/verify-aiife/bin/control-aiife drive \
  --game the-great-hall \
  --commands "look;north;look" \
  --output-dir artifacts/verify-aiife/nav-proof

# 3. Drive with save file capture
.agents/skills/verify-aiife/bin/control-aiife drive \
  --game the-great-hall \
  --commands "north;save slot-alpha;quit" \
  --save-slot slot-alpha \
  --output-dir artifacts/verify-aiife/save-proof

# 4. Clean up temporary test files
.agents/skills/verify-aiife/bin/control-aiife cleanup
```
