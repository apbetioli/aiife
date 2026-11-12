import { produce } from "immer";
import type { GameState, ObjectState } from "./types";

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
	return state.objects[objectId]?.location === "inventory";
}

/** Returns all object IDs currently in the player's inventory based on object locations. */
export function getInventory(state: GameState): string[] {
	return Object.keys(state.objects).filter((id) => state.objects[id]?.location === "inventory");
}

/**
 * Returns the immediate container ID if objectId is inside an open container hierarchy
 * located in the current room or carried in inventory.
 */
export function findOpenContainerInRoom(state: GameState, objectId: string): string | undefined {
	const immediateContainerId = state.objects[objectId]?.location;
	if (!immediateContainerId || !state.objects[immediateContainerId]) {
		return undefined;
	}

	const visited = new Set<string>();
	let currId: string | undefined = immediateContainerId;

	while (currId && state.objects[currId]) {
		if (visited.has(currId)) break;
		visited.add(currId);

		const curr: ObjectState = state.objects[currId];
		if (curr.state.open !== true) {
			return undefined;
		}

		const nextLoc: string | null = curr.location;
		if (!nextLoc) {
			return undefined;
		}
		if (nextLoc === state.player.current_room || nextLoc === "inventory") {
			return immediateContainerId;
		}

		currId = nextLoc;
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

/**
 * Generic object movement mutator.
 * Moves an object to any target location (a room ID, a container ID, or "inventory").
 *
 * @param state - Current game state (inside produce / immutable)
 * @param objectId - ID of the object to move
 * @param toLocation - Target destination (room ID, container ID, or "inventory")
 * @param options.expectedFrom - Optional source location check; throws if object is not currently there
 */
export function moveObject(
	state: GameState,
	objectId: string,
	toLocation: string | null,
	options?: { expectedFrom?: string | null },
): void {
	const obj = state.objects[objectId];
	if (!obj) {
		throw new Error(`Object "${objectId}" does not exist`);
	}
	if (options?.expectedFrom !== undefined && obj.location !== options.expectedFrom) {
		throw new Error(
			`Object "${objectId}" is not at location "${options.expectedFrom}" (currently at "${obj.location}")`,
		);
	}
	if (toLocation !== null) {
		if (objectId === toLocation) {
			throw new Error(`Cannot move object "${objectId}" inside itself`);
		}
		let curr: string | null | undefined = toLocation;
		while (curr && curr !== "inventory" && state.objects[curr]) {
			if (curr === objectId) {
				throw new Error(`Cannot move object "${objectId}" inside one of its contents ("${toLocation}")`);
			}
			curr = state.objects[curr].location;
		}
	}
	obj.location = toLocation;
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
