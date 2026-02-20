import type { GameState, Item, NPC, Room } from "../types.js";

export function getCurrentRoom(state: GameState): Room {
  const room = state.rooms.get(state.currentRoomId);
  if (!room) throw new Error(`Room not found: ${state.currentRoomId}`);
  return room;
}

export function getVisibleItems(state: GameState): Item[] {
  const room = getCurrentRoom(state);
  return room.itemIds
    .map((id) => state.items.get(id))
    .filter((item): item is Item => item !== undefined && item.visible);
}

export function getInventoryItems(state: GameState): Item[] {
  return state.inventory
    .map((id) => state.items.get(id))
    .filter((item): item is Item => item !== undefined);
}

export function getRoomNPCs(state: GameState): NPC[] {
  const room = getCurrentRoom(state);
  return room.npcIds
    .map((id) => state.npcs.get(id))
    .filter((npc): npc is NPC => npc !== undefined);
}

export function resolveEntity(
  name: string | undefined,
  candidates: (Item | NPC)[]
): Item | NPC | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();

  for (const entity of candidates) {
    if (entity.name.toLowerCase() === lower) return entity;
  }

  for (const entity of candidates) {
    if ("aliases" in entity) {
      for (const alias of entity.aliases) {
        if (alias.toLowerCase() === lower) return entity;
      }
    }
  }

  for (const entity of candidates) {
    if (
      entity.name.toLowerCase().includes(lower) ||
      lower.includes(entity.name.toLowerCase())
    ) {
      return entity;
    }
  }

  for (const entity of candidates) {
    if ("aliases" in entity) {
      for (const alias of entity.aliases) {
        if (
          alias.toLowerCase().includes(lower) ||
          lower.includes(alias.toLowerCase())
        ) {
          return entity;
        }
      }
    }
  }

  return undefined;
}

export function resolveItem(
  name: string | undefined,
  state: GameState
): Item | undefined {
  if (!name) return undefined;
  const visibleItems = getVisibleItems(state);
  const inventoryItems = getInventoryItems(state);
  const allItems = [...visibleItems, ...inventoryItems];
  return resolveEntity(name, allItems) as Item | undefined;
}

export function resolveNPC(
  name: string | undefined,
  state: GameState
): NPC | undefined {
  if (!name) return undefined;
  const npcs = getRoomNPCs(state);
  return resolveEntity(name, npcs) as NPC | undefined;
}

export function isItemInRoom(itemId: string, state: GameState): boolean {
  const room = getCurrentRoom(state);
  return room.itemIds.includes(itemId);
}

export function isItemInInventory(itemId: string, state: GameState): boolean {
  return state.inventory.includes(itemId);
}
