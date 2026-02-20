import { readFileSync } from "fs";
import { resolve } from "path";
import type { GameState, Item, NPC, Room, WorldDefinition } from "../types.js";

export function loadWorldFromFile(): GameState {
  const worldArg = process.argv.find((a) => a.startsWith("--world="));
  const worldPath = worldArg
    ? worldArg.slice("--world=".length)
    : "games/zorky.json";

  try {
    const absPath = resolve(worldPath);
    let raw: string;
    try {
      raw = readFileSync(absPath, "utf-8");
    } catch {
      throw new Error(`Could not read world file: ${absPath}`);
    }

    let definition: WorldDefinition;
    try {
      definition = JSON.parse(raw) as WorldDefinition;
    } catch {
      throw new Error(`Invalid JSON in world file: ${absPath}`);
    }

    return loadWorld(definition);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

export function loadWorld(definition: WorldDefinition): GameState {
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

  return {
    rooms,
    items,
    npcs,
    currentRoomId: definition.startRoomId,
    inventory: [],
    turnCount: 0,
    gameOver: false,
    flags,
    welcomeMessage: definition.welcomeMessage,
  };
}
