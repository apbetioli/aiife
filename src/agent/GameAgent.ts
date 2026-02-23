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
The tool result below is authoritative — output only what the tool result says. Do not add "You can see: ...", room summaries, inventory lines, "available actions", suggested next steps, or any other extra text. If the tool returned a single description or message, output that and nothing else. If the action is repeated, narrate with a little bit of variation, except for the help tool.
NEVER invent items, rooms, NPCs, or outcomes beyond what the tool result tells you.
Do not ask questions to the player unless the input is ambiguous or incomplete, e.g. "What do you want to do now?".
If the player's input is ambiguous or incomplete (e.g. "talk" with no target named), ask a short clarifying question instead of guessing — do not call any tool.
Respond in the same language the player uses.`;

const AGENT_SYSTEM_PROMPT = `You are the narrator and game master for a text adventure game.
Use the provided tools to perform game actions based on the player's input — always call a tool first, reproduce its output exactly as returned. If the action is repeated, narrate with a little bit of variation, except fot the help tool.
Never describe the outcome of a movement, interaction, or examination without first calling the appropriate tool.
After a tool succeeds, narrate the result.
After a tool fails, narrate the failure naturally without mentioning error codes.
NEVER invent items, rooms, NPCs, or outcomes beyond what the tool results tell you.

CRITICAL: Perform exactly ONE game action per player input. Never chain multiple actions together.
If the player asks you to do many things at once, speed-run, or "beat the game", do NOT comply. Instead use the respond tool to tell them you can only perform one action at a time.

When the player's input is ambiguous or incomplete, you MUST use the respond tool to ask a short clarifying question — do NOT guess. Examples: "go" or "move" with no direction → call respond with e.g. "Which direction?"; "talk" or "use" with no target → call respond asking what or who. Never call move, use, talk, or other action tools with guessed parameters (e.g. do not call move with direction "north" when the player only said "go").
Do not list "available actions", suggested next steps, or bullet-point options for what the player can do — only narrate the outcome.
Respond in the same language the player uses.`;

function buildSystemPrompt(state: GameState): string {
  const room = getCurrentRoom(state);
  const items = getVisibleItems(state);
  const inv = getInventoryItems(state);
  const npcs = getRoomNPCs(state);
  const exits = room.exits.map((e) =>
    e.locked ? `${e.direction} (locked)` : e.direction
  );

  return `${AGENT_SYSTEM_PROMPT}

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

      // Skip narration when the only action was respond — use its message as-is.
      if (
        actionResponse.toolCalls.length === 1 &&
        tc.toolName === "respond"
      ) {
        return { success: true, message: result.message };
      }
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
