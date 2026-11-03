import { produce } from "immer";
import type { GameState } from "./types";

/**
 * State helpers and mutators.
 * All mutators modify state in place — use inside immer's `produce` (e.g. event bus listeners)
 */

// ─── Query Helpers ───────────────────────────────────────────────────────────

export function getObjectsInRoom(state: GameState, roomId: string): string[] {
	return Object.keys(state.objects).filter((id) => state.objects[id]?.location === roomId);
}

export function getObjectsInContainer(state: GameState, containerId: string): string[] {
	return Object.keys(state.objects).filter((id) => state.objects[id]?.location === containerId);
}

export function isInRoom(state: GameState, objectId: string): boolean {
	return state.objects[objectId]?.location === state.player.current_room;
}

export function isInInventory(state: GameState, objectId: string): boolean {
	return state.objects[objectId]?.location === "inventory" || state.player.inventory.includes(objectId);
}

/** Returns the container ID if objectId is inside an open container in the current room. */
export function findOpenContainerInRoom(state: GameState, objectId: string): string | undefined {
	const loc = state.objects[objectId]?.location;
	if (loc && state.objects[loc]) {
		const container = state.objects[loc];
		if (container.state.open && container.location === state.player.current_room) {
			return loc;
		}
	}
	return undefined;
}

/** True if the object is visible/accessible: in current room, in inventory, or inside an open container here. */
export function isInScope(state: GameState, objectId: string): boolean {
	return isInRoom(state, objectId) || isInInventory(state, objectId) || !!findOpenContainerInRoom(state, objectId);
}

// ─── Immutable wrapper ───────────────────────────────────────────────────────

/** Apply an in-place mutator to a frozen state, returning a new state via immer. */
export function immutable(state: GameState, fn: (state: GameState) => void): GameState {
	return produce(state, fn);
}

// ─── In-place mutators ──────────────────────────────────────────────────────

export function moveObjectFromRoomToInventory(state: GameState, objectId: string): void {
	const roomId = state.player.current_room;
	if (state.objects[objectId]?.location !== roomId) {
		throw new Error(`Object "${objectId}" is not in room "${roomId}"`);
	}
	state.objects[objectId].location = "inventory";
	if (!state.player.inventory.includes(objectId)) {
		state.player.inventory.push(objectId);
	}
}

export function moveObjectFromInventoryToRoom(state: GameState, objectId: string, roomId: string): void {
	const idx = state.player.inventory.indexOf(objectId);
	if (idx === -1 && state.objects[objectId]?.location !== "inventory") {
		throw new Error(`Object "${objectId}" is not in inventory`);
	}
	if (idx !== -1) {
		state.player.inventory.splice(idx, 1);
	}
	state.objects[objectId].location = roomId;
}

export function moveObjectFromContainerToInventory(state: GameState, objectId: string, containerId: string): void {
	if (state.objects[objectId]?.location !== containerId) {
		throw new Error(`Object "${objectId}" is not in container "${containerId}"`);
	}
	state.objects[objectId].location = "inventory";
	if (!state.player.inventory.includes(objectId)) {
		state.player.inventory.push(objectId);
	}
}

export function moveObjectFromInventoryToContainer(state: GameState, objectId: string, containerId: string): void {
	const idx = state.player.inventory.indexOf(objectId);
	if (idx === -1 && state.objects[objectId]?.location !== "inventory") {
		throw new Error(`Object "${objectId}" is not in inventory`);
	}
	if (idx !== -1) {
		state.player.inventory.splice(idx, 1);
	}
	state.objects[objectId].location = containerId;
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
