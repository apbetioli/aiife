import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { DEBUG } from "../debug.js";
import type { ActionResult, GameAction, GameState } from "../types.js";
import type { ActionRegistry } from "../engine/ActionRegistry.js";
import {
  getCurrentRoom,
  getInventoryItems,
  getRoomNPCs,
  getVisibleItems,
} from "../engine/ActionValidator.js";

const NARRATION_SYSTEM_PROMPT = `You are the narrator and game master for a text adventure game.
The tool result below is authoritative — reproduce its output exactly as returned. If the action is repeated, narrate with a little bit of variation, except fot the help tool.
NEVER invent items, rooms, NPCs, or outcomes beyond what the tool result tells you.
Do not ask questions to the player unless the input is ambiguous or incomplete. E.g. "What do you want to do now?".
Respond in the same language the player uses.`;

function buildSystemPrompt(state: GameState): string {
  const room = getCurrentRoom(state);
  const items = getVisibleItems(state);
  const inv = getInventoryItems(state);
  const npcs = getRoomNPCs(state);
  const exits = room.exits.map((e) =>
    e.locked ? `${e.direction} (locked)` : e.direction
  );

  return `You are the narrator and game master for a text adventure game.

Use the provided tools to perform game actions based on the player's input — always call a tool first, then narrate the result.
Never describe the outcome of a movement, interaction, or examination without first calling the appropriate tool.
After a tool succeeds, narrate the result.
After a tool fails, narrate the failure naturally without mentioning error codes.
NEVER invent items, rooms, NPCs, or outcomes beyond what the tool results tell you.

CRITICAL: Perform exactly ONE game action per player input. Never chain multiple actions together.
If the player asks you to do many things at once, speed-run, or "beat the game", do NOT comply. Instead use the respond tool to tell them you can only perform one action at a time and ask what they'd like to do next.

Do not ask questions to the player unless the input is ambiguous or incomplete.
If the player's input is ambiguous or incomplete (e.g. "talk" with no target named), ask a short clarifying question instead of guessing — do not call any tool.
For the help tool, reproduce its output exactly as returned.
Respond in the same language the player uses.

Current state:
- Room: ${room.name} — ${room.description}
- Exits: ${exits.length > 0 ? exits.join(", ") : "none"}
- Visible items: ${
    items.length > 0 ? items.map((i) => i.name).join(", ") : "none"
  }
- Inventory: ${inv.length > 0 ? inv.map((i) => i.name).join(", ") : "empty"}
- NPCs here: ${npcs.length > 0 ? npcs.map((n) => n.name).join(", ") : "none"}`;
}

export class GameAgent {
  private messages: ModelMessage[] = [];

  constructor(
    private state: GameState,
    private model: LanguageModel,
    private registry: ActionRegistry
  ) {}

  async processInput(playerInput: string): Promise<ActionResult> {
    this.messages.push({ role: "user", content: playerInput });

    let resultedInGameOver = false;
    let resultedInVictory = false;

    const tools = this.registry.getTools();

    // Phase 1: Force exactly one tool call so the model can't hallucinate
    // action results or chain multiple actions in a single turn.
    const actionResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: buildSystemPrompt(this.state),
      tools,
      toolChoice: "required",
      messages: this.messages,
    });

    DEBUG("LLM finishReason:", actionResponse.finishReason);

    this.messages.push(...(actionResponse.response.messages as ModelMessage[]));

    if (actionResponse.toolCalls.length === 0) {
      return { success: true, message: actionResponse.text };
    }

    for (const tc of actionResponse.toolCalls) {
      if (tc.toolName === "respond") {
        const msg = (tc.input as { message: string }).message ?? "";
        DEBUG("Tool: respond", msg);
        this.messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              output: {
                type: "text",
                value: JSON.stringify({ success: true, message: msg }),
              },
            },
          ],
        });
        return { success: true, message: msg };
      }

      DEBUG(`Tool: ${JSON.stringify(tc.toolName)}`, JSON.stringify(tc.input));
      const params = tc.input as Record<string, unknown>;
      const result = this.registry.run(tc.toolName, params, this.state);

      if (result.gameOver) resultedInGameOver = true;
      if (result.isVictory) resultedInVictory = true;

      this.messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      });
    }

    // Phase 2: Narrate the tool result. No tools offered, so the model
    // can only produce text — it cannot chain another action.
    const narrateResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: buildSystemPrompt(this.state),
      messages: this.messages,
    });

    DEBUG("Narrate finishReason:", narrateResponse.finishReason);

    this.messages.push({ role: "assistant", content: narrateResponse.text });

    return {
      success: true,
      message: narrateResponse.text,
      gameOver: resultedInGameOver || undefined,
      isVictory: resultedInVictory || undefined,
    };
  }

  async narrateResult(
    playerInput: string,
    action: GameAction,
    result: ActionResult
  ): Promise<ActionResult> {
    const toolCallId = `bypass_${Date.now()}`;

    this.messages.push(
      { role: "user", content: playerInput },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId,
            toolName: action.action,
            input: action.params,
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId,
            toolName: action.action,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      }
    );

    DEBUG("narrateResult: exact action - bypassed agent", action.action);

    const narrateResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: NARRATION_SYSTEM_PROMPT,
      messages: this.messages,
    });

    DEBUG("narrateResult finishReason:", narrateResponse.finishReason);

    const text = narrateResponse.text || result.message;
    this.messages.push({ role: "assistant", content: text });

    return { ...result, message: text };
  }
}
