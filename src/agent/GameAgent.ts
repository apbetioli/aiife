import Anthropic from "@anthropic-ai/sdk";
import { DEBUG } from "../debug.js";
import type { ActionResult, GameAction, GameState } from "../types.js";
import { executeAction, validateAction } from "../engine/ActionRegistry.js";
import {
  getCurrentRoom,
  getInventoryItems,
  getRoomNPCs,
  getVisibleItems,
} from "../engine/ActionValidator.js";

const GAME_TOOLS: Anthropic.Tool[] = [
  {
    name: "move",
    description: "Move the player in a direction",
    input_schema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["north", "south", "east", "west", "up", "down"],
          description: "The direction to move",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "take",
    description: "Pick up an item from the current room",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Name of the item to take" },
      },
      required: ["item"],
    },
  },
  {
    name: "drop",
    description: "Drop an item from inventory into the current room",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Name of the item to drop" },
      },
      required: ["item"],
    },
  },
  {
    name: "use",
    description: "Use an item from inventory, optionally on a target",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Name of the item to use" },
        target: {
          type: "string",
          description: "Optional target to use the item on",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "examine",
    description: "Look closely at an item, NPC, or feature in the current room",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "What to examine" },
      },
      required: ["target"],
    },
  },
  {
    name: "look",
    description: "Look around the current room",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "talk",
    description: "Talk to an NPC in the current room",
    input_schema: {
      type: "object",
      properties: {
        npc: { type: "string", description: "Name of the NPC to talk to" },
      },
      required: ["npc"],
    },
  },
  {
    name: "open",
    description: "Open a container or door",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "What to open" },
      },
      required: ["target"],
    },
  },
  {
    name: "inventory",
    description: "Check what the player is carrying",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "help",
    description: "Show the list of available commands",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "quit",
    description: "End the game",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "respond",
    description:
      "Use this instead of a game-action tool when you need to reply without changing game state — for example to ask a clarifying question, respond to conversational input, or tell the player you don't understand.",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to show the player",
        },
      },
      required: ["message"],
    },
  },
];

function buildSystemPrompt(state: GameState): string {
  const room = getCurrentRoom(state);
  const items = getVisibleItems(state);
  const inv = getInventoryItems(state);
  const npcs = getRoomNPCs(state);
  const exits = room.exits.map((e) =>
    e.locked ? `${e.direction} (locked)` : e.direction
  );

  return `You are the narrator and game master for a text adventure game.

Use the provided tools to perform ALL game actions based on the player's input — always call a tool first, then narrate the result. 
Never describe the outcome of a movement, interaction, or examination without first calling the appropriate tool. 
After a tool succeeds, narrate the result. 
After a tool fails, narrate the failure naturally without mentioning error codes. 
Never invent items, rooms, NPCs, or outcomes beyond what the tool results tell you.

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

  const validation = validateAction(action, state);
  if (!validation.valid) {
    return { success: false, message: validation.error ?? "You can't do that." };
  }

  return executeAction(action, state);
}

export class GameAgent {
  private client: Anthropic;
  private model: string;
  private messages: Anthropic.MessageParam[] = [];

  constructor(private state: GameState) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required.");
    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  }

  async processInput(playerInput: string): Promise<ActionResult> {
    this.messages.push({ role: "user", content: playerInput });

    // Flags to propagate from tool results to the final return value
    let resultedInGameOver = false;
    let resultedInVictory = false;
    let toolHasBeenCalled = false;

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: buildSystemPrompt(this.state),
        tools: GAME_TOOLS,
        // Force a tool call on the first turn so the model can't hallucinate
        // action results. After tool results are in, allow free-form narration.
        tool_choice: toolHasBeenCalled ? { type: "auto" } : { type: "any" },
        messages: this.messages,
      });

      DEBUG("LLM stop_reason:", response.stop_reason);

      if (response.stop_reason === "end_turn") {
        const text =
          response.content.find((b) => b.type === "text")?.text ?? "";
        this.messages.push({ role: "assistant", content: response.content });
        return {
          success: true,
          message: text,
          gameOver: resultedInGameOver || undefined,
          isVictory: resultedInVictory || undefined,
        };
      }

      if (response.stop_reason === "tool_use") {
        toolHasBeenCalled = true;
        this.messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          // `respond` is a pure-text escape hatch — return the model's
          // message directly without another round-trip to the LLM.
          if (block.name === "respond") {
            const msg =
              (block.input as Record<string, string>).message ?? "";
            DEBUG("Tool: respond", msg);
            this.messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({ success: true, message: msg }),
                },
              ],
            });
            return { success: true, message: msg };
          }

          DEBUG(`Tool: ${block.name}`, block.input);
          const result = executeTool(
            block.name,
            block.input as Record<string, string>,
            this.state
          );

          if (result.gameOver) resultedInGameOver = true;
          if (result.isVictory) resultedInVictory = true;

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        this.messages.push({ role: "user", content: toolResults });
      }
    }
  }
}
