import type { ActionResult, GameState } from "../types.js";
import { getCurrentRoom, getVisibleItems, getRoomNPCs } from "./ActionValidator.js";
import { GameAgent } from "../agent/GameAgent.js";

export class GameEngine {
  private agent: GameAgent;

  constructor(private state: GameState) {
    this.agent = new GameAgent(state);
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

    const intro = (this.state.welcomeMessage ?? "").trim();
    let message = intro ? `${intro}\n\n` : "";
    message += `**${room.name}**\n${room.description}`;
    if (items.length > 0) {
      message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
    }
    if (npcs.length > 0) {
      message += `\n\n${npcs.map((n) => `There is a ${n.name} here.`).join(" ")}`;
    }
    return message;
  }
}
