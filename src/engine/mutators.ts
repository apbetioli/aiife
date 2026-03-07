import { produce } from "immer";
import type { GameState } from "./types";

/**
 * State helpers and mutators. 
 * All mutators modify state in place — use inside immer's `produce` (e.g. event bus listeners)
 */

// ─── Query Helpers ───────────────────────────────────────────────────────────

export function isInRoom(state: GameState, objectId: string): boolean {
	const room = state.rooms[state.player.current_room];
	return room.contains.includes(objectId);
}

export function isInInventory(state: GameState, objectId: string): boolean {
	return state.player.inventory.includes(objectId);
}

/** Returns the container ID if objectId is inside an open container in the current room. */
export function findOpenContainerInRoom(state: GameState, objectId: string): string | undefined {
	const room = state.rooms[state.player.current_room];
	for (const cid of room.contains) {
		const container = state.objects[cid];
		if (container?.state.open && container.contains?.includes(objectId)) {
			return cid;
		}
	}
	return undefined;
}

// ─── Immutable wrapper ───────────────────────────────────────────────────────

/** Apply an in-place mutator to a frozen state, returning a new state via immer. */
export function immutable(state: GameState, fn: (state: GameState) => void): GameState {
	return produce(state, fn);
}

// ─── In-place mutators ──────────────────────────────────────────────────────

export function moveObjectFromRoomToInventory(state: GameState, objectId: string): void {
	const roomId = state.player.current_room;
	const room = state.rooms[roomId];
	if (!room.contains.includes(objectId)) {
		throw new Error(`Object "${objectId}" is not in room "${roomId}"`);
	}
	room.contains = room.contains.filter((id) => id !== objectId);
	state.player.inventory.push(objectId);
}

export function moveObjectFromInventoryToRoom(state: GameState, objectId: string, roomId: string): void {
	const idx = state.player.inventory.indexOf(objectId);
	if (idx === -1) throw new Error(`Object "${objectId}" is not in inventory`);
	state.player.inventory.splice(idx, 1);
	const room = state.rooms[roomId];
	room.contains.push(objectId);
}

export function moveObjectFromContainerToInventory(state: GameState, objectId: string, containerId: string): void {
	const container = state.objects[containerId];
	if (!container?.contains?.includes(objectId)) {
		throw new Error(`Object "${objectId}" is not in container "${containerId}"`);
	}
	container.contains = (container.contains ?? []).filter((id) => id !== objectId);
	state.player.inventory.push(objectId);
}

export function moveObjectFromInventoryToContainer(state: GameState, objectId: string, containerId: string): void {
	const idx = state.player.inventory.indexOf(objectId);
	if (idx === -1) throw new Error(`Object "${objectId}" is not in inventory`);
	state.player.inventory.splice(idx, 1);
	const container = state.objects[containerId];
	container.contains = [...(container.contains ?? []), objectId];
}

export function setObjectState(
	state: GameState,
	objectId: string,
	key: string,
	value: boolean | string | number,
): void {
	const obj = state.objects[objectId];
	if (!obj) throw new Error(`Object "${objectId}" does not exist`);
	obj.state = { ...obj.state, [key]: value };
}

export function setRoomState(state: GameState, roomId: string, key: string, value: boolean | string | number): void {
	const room = state.rooms[roomId];
	if (!room) throw new Error(`Room "${roomId}" does not exist`);
	room.state = { ...room.state, [key]: value };
}

export function setPlayerState(state: GameState, key: string, value: boolean | string | number): void {
	state.player.state = { ...state.player.state, [key]: value };
}

export function movePlayer(state: GameState, roomId: string): void {
	state.player.current_room = roomId;
}

export function ensureVisited(state: GameState, roomId: string): void {
	const room = state.rooms[roomId];
	if (room.state.visited) return;
	room.state = { ...room.state, visited: true };
}
