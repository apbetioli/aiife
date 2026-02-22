import { generateText, tool, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";
import { DEBUG } from "../debug.js";
import type { ActionResult, GameAction, GameState } from "../types.js";
import { runAction } from "../engine/ActionRegistry.js";
import {
  getCurrentRoom,
  getInventoryItems,
  getRoomNPCs,
  getVisibleItems,
} from "../engine/ActionValidator.js";
import { actionToToolParams } from "../engine/CommandParser.js";

const gameTools = {
  move: tool({
    description: "Move the player in a direction",
    inputSchema: z.object({
      direction: z.enum(["north", "south", "east", "west", "up", "down"]),
    }),
  }),
  take: tool({
    description: "Pick up an item from the current room",
    inputSchema: z.object({ item: z.string().describe("Name of the item to take") }),
  }),
  drop: tool({
    description: "Drop an item from inventory into the current room",
    inputSchema: z.object({ item: z.string().describe("Name of the item to drop") }),
  }),
  use: tool({
    description: "Use an item from inventory, optionally on a target",
    inputSchema: z.object({
      item: z.string().describe("Name of the item to use"),
      target: z.string().optional().describe("Optional target to use the item on"),
    }),
  }),
  examine: tool({
    description:
      "Look closely at an item, NPC, or feature in the current room",
    inputSchema: z.object({ target: z.string().describe("What to examine") }),
  }),
  look: tool({
    description: "Look around the current room",
    inputSchema: z.object({}),
  }),
  talk: tool({
    description: "Talk to an NPC in the current room",
    inputSchema: z.object({ npc: z.string().describe("Name of the NPC to talk to") }),
  }),
  open: tool({
    description: "Open a container or door",
    inputSchema: z.object({ target: z.string().describe("What to open") }),
  }),
  inventory: tool({
    description: "Check what the player is carrying",
    inputSchema: z.object({}),
  }),
  help: tool({
    description: "Show the list of available commands",
    inputSchema: z.object({}),
  }),
  quit: tool({
    description: "End the game",
    inputSchema: z.object({}),
  }),
  respond: tool({
    description:
      "Use this instead of a game-action tool when you need to reply without changing game state — for example to ask a clarifying question, respond to conversational input, or tell the player you don't understand.",
    inputSchema: z.object({
      message: z.string().describe("The message to show the player"),
    }),
  }),
};

const NARRATION_SYSTEM_PROMPT = `You are the narrator and game master for a text adventure game.
The tool result below is authoritative — narrate its outcome naturally. Do not change too much from the tool result.
Never invent items, rooms, NPCs, or outcomes beyond what the tool result tells you.
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
Never invent items, rooms, NPCs, or outcomes beyond what the tool results tell you.

CRITICAL: Perform exactly ONE game action per player input. Never chain multiple actions together.
If the player asks you to do many things at once, speed-run, or "beat the game", do NOT comply. Instead use the respond tool to tell them you can only perform one action at a time and ask what they'd like to do next.

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

function executeTool(
  name: string,
  input: Record<string, string>,
  state: GameState
): ActionResult {
  const action: GameAction = { actionType: name as GameAction["actionType"] };

  switch (name) {
    case "move":
      action.direction = input.direction as GameAction["direction"];
      break;
    case "take":
    case "drop":
      action.target = input.item;
      break;
    case "respond":
      action.target = input.message;
      break;
    case "use":
      action.target = input.item;
      if (input.target) action.secondaryTarget = input.target;
      break;
    case "examine":
    case "open":
      action.target = input.target;
      break;
    case "talk":
      action.target = input.npc;
      break;
  }

  return runAction(action, state);
}

export class GameAgent {
  private messages: ModelMessage[] = [];

  constructor(
    private state: GameState,
    private model: LanguageModel
  ) {}

  async processInput(playerInput: string): Promise<ActionResult> {
    this.messages.push({ role: "user", content: playerInput });

    let resultedInGameOver = false;
    let resultedInVictory = false;

    // Phase 1: Force exactly one tool call so the model can't hallucinate
    // action results or chain multiple actions in a single turn.
    const actionResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: buildSystemPrompt(this.state),
      tools: gameTools,
      toolChoice: "required",
      messages: this.messages,
    });

    DEBUG("LLM finishReason:", actionResponse.finishReason);

    this.messages.push(
      ...(actionResponse.response.messages as ModelMessage[])
    );

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

      DEBUG(`Tool: ${tc.toolName}`, tc.input);
      const result = executeTool(
        tc.toolName,
        tc.input as Record<string, string>,
        this.state
      );

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
    const { name, input } = actionToToolParams(action);

    this.messages.push(
      { role: "user", content: playerInput },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId,
            toolName: name,
            input,
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId,
            toolName: name,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      }
    );

    DEBUG("narrateResult: bypassed Phase 1 for action", action.actionType);

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
