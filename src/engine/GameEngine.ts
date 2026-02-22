import type { LanguageModel } from "ai";
import { GameAgent } from "../agent/GameAgent.js";
import { runAction } from "./ActionRegistry.js";
import { parseCommand } from "./CommandParser.js";
import type {
  ActionResult,
  GameState,
  Item,
  NPC,
  Room,
  WorldDefinition,
} from "../types.js";

export class GameEngine {
  private state: GameState;
  private agent: GameAgent;

  constructor(definition: WorldDefinition, model: LanguageModel) {
    const rooms = new Map<string, Room>();
    for (const roomDef of definition.rooms) {
      rooms.set(roomDef.id, { ...roomDef });
    }

    const items = new Map<string, Item>();
    for (const item of definition.items) {
      items.set(item.id, { ...item });
    }

    const npcs = new Map<string, NPC>();
    for (const npc of definition.npcs) {
      npcs.set(npc.id, { ...npc });
    }

    const flags = new Map<string, boolean>();
    for (const [key, value] of Object.entries(definition.flags)) {
      flags.set(key, value);
    }

    this.state = {
      rooms,
      items,
      npcs,
      interactions: definition.interactions ?? [],
      currentRoomId: definition.startRoomId,
      inventory: [],
      turnCount: 0,
      gameOver: false,
      flags,
    };
    this.agent = new GameAgent(this.state, model);
  }

  start() {
    return runAction({ actionType: "look" }, this.state);
  }

  getState(): GameState {
    return this.state;
  }

  async processInput(input: string): Promise<ActionResult> {
    const trimmed = input.trim();
    if (!trimmed) return { message: "Say something!", success: false };

    const actionMatch = parseCommand(trimmed);

    if (!actionMatch) {
      // There is no exact match, run the agent to identify intent and run the action
      return this.agent.processInput(trimmed);
    }

    this.state.turnCount++;

    const result = runAction(actionMatch, this.state);
    return this.agent.narrateResult(trimmed, actionMatch, result);
  }
}
