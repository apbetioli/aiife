import type {
  ActionResult,
  GameState,
  LLMProvider,
  ParsedAction,
  ParserContext,
} from "../types.js";
import {
  getCurrentRoom,
  getVisibleItems,
  getInventoryItems,
  getRoomNPCs,
} from "./ActionValidator.js";
import { validateAction, executeAction } from "./ActionRegistry.js";

export class GameEngine {
  private state: GameState;
  private parser: LLMProvider;

  constructor(state: GameState, parser: LLMProvider) {
    this.state = state;
    this.parser = parser;
  }

  getState(): GameState {
    return this.state;
  }

  buildContext(): ParserContext {
    const room = getCurrentRoom(this.state);
    const items = getVisibleItems(this.state);
    const inv = getInventoryItems(this.state);
    const npcs = getRoomNPCs(this.state);

    return {
      roomName: room.name,
      roomDescription: room.description,
      exits: room.exits.map((e) => {
        let label = e.direction;
        if (e.locked) label += " (locked)";
        return label;
      }),
      visibleItems: items.map((i) => i.name),
      inventory: inv.map((i) => i.name),
      npcs: npcs.map((n) => n.name),
    };
  }

  async processInput(input: string): Promise<ActionResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { message: "Say something!", success: false };
    }

    const context = this.buildContext();
    let action: ParsedAction;

    try {
      action = await this.parser.parseInput(trimmed, context);
    } catch (e) {
      console.error("Error parsing input:", e);
      return {
        message: "I didn't understand that. Try 'help' for a list of commands.",
        success: false,
      };
    }

    const validation = validateAction(action, this.state);
    if (!validation.valid) {
      return {
        message: validation.error ?? "You can't do that.",
        success: false,
      };
    }

    this.state.turnCount++;
    return executeAction(action, this.state);
  }

  getWelcome(): string {
    const room = getCurrentRoom(this.state);
    const items = getVisibleItems(this.state);
    const npcs = getRoomNPCs(this.state);

    let message = `**Welcome to Zorky!**\nAn interactive fiction adventure. Type 'help' for commands.\n`;
    message += `\n**${room.name}**\n${room.description}`;
    if (items.length > 0) {
      message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
    }
    if (npcs.length > 0) {
      message += `\n\n${npcs
        .map((n) => `There is a ${n.name} here.`)
        .join(" ")}`;
    }
    return message;
  }
}
