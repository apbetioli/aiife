import { GameAgent } from "../agent/GameAgent.js";
import type {
  ActionResult,
  GameState,
  Item,
  NPC,
  Room,
  WorldDefinition,
} from "../types.js";
import {
  getCurrentRoom,
  getRoomNPCs,
  getVisibleItems,
} from "./ActionValidator.js";

export class GameEngine {
  private state: GameState;
  private welcomeMessage: string;
  private agent: GameAgent;

  constructor(definition: WorldDefinition) {
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
      currentRoomId: definition.startRoomId,
      inventory: [],
      turnCount: 0,
      gameOver: false,
      flags,
    };
    this.welcomeMessage = definition.welcomeMessage;
    this.agent = new GameAgent(this.state);
  }

  getState(): GameState {
    return this.state;
  }

  async processInput(input: string): Promise<ActionResult> {
    const trimmed = input.trim();
    if (!trimmed) return { message: "Say something!", success: false };
    return this.agent.processInput(trimmed);
  }

  getWelcome(): string {
    const room = getCurrentRoom(this.state);
    const items = getVisibleItems(this.state);
    const npcs = getRoomNPCs(this.state);

    const intro = this.welcomeMessage.trim();
    let message = intro ? `${intro}\n\n` : "";
    message += `**${room.name}**\n${room.description}`;
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
