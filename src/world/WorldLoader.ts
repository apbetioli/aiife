import type { WorldDefinition, GameState, Room, Item, NPC } from "../types.js";

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
  };
}
