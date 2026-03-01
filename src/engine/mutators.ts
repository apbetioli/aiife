import type { GameState } from "./types";

// ─── Query Helpers ───────────────────────────────────────────────────────────

export function isInRoom(state: GameState, objectId: string): boolean {
	const room = state.rooms[state.player.current_room];
	return room.contains.includes(objectId);
}

export function isInInventory(state: GameState, objectId: string): boolean {
	return state.player.inventory.includes(objectId);
}

// ─── Move Functions ──────────────────────────────────────────────────────────

export function moveObjectFromRoomToInventory(
	state: GameState,
	objectId: string,
): GameState {
	const roomId = state.player.current_room;
	const room = state.rooms[roomId];

	if (!room.contains.includes(objectId)) {
		throw new Error(
			`Object "${objectId}" is not in room "${roomId}"`,
		);
	}

	return {
		...state,
		rooms: {
			...state.rooms,
			[roomId]: {
				...room,
				contains: room.contains.filter((id) => id !== objectId),
			},
		},
		player: {
			...state.player,
			inventory: [...state.player.inventory, objectId],
		},
	};
}

export function moveObjectFromInventoryToRoom(
	state: GameState,
	objectId: string,
	roomId: string,
): GameState {
	if (!state.player.inventory.includes(objectId)) {
		throw new Error(`Object "${objectId}" is not in inventory`);
	}

	const room = state.rooms[roomId];

	return {
		...state,
		rooms: {
			...state.rooms,
			[roomId]: {
				...room,
				contains: [...room.contains, objectId],
			},
		},
		player: {
			...state.player,
			inventory: state.player.inventory.filter((id) => id !== objectId),
		},
	};
}

export function moveObjectFromContainerToInventory(
	state: GameState,
	objectId: string,
	containerId: string,
): GameState {
	const container = state.objects[containerId];

	if (!container?.contains?.includes(objectId)) {
		throw new Error(
			`Object "${objectId}" is not in container "${containerId}"`,
		);
	}

	return {
		...state,
		objects: {
			...state.objects,
			[containerId]: {
				...container,
				contains: container.contains.filter((id) => id !== objectId),
			},
		},
		player: {
			...state.player,
			inventory: [...state.player.inventory, objectId],
		},
	};
}

export function moveObjectFromInventoryToContainer(
	state: GameState,
	objectId: string,
	containerId: string,
): GameState {
	if (!state.player.inventory.includes(objectId)) {
		throw new Error(`Object "${objectId}" is not in inventory`);
	}

	const container = state.objects[containerId];

	return {
		...state,
		objects: {
			...state.objects,
			[containerId]: {
				...container,
				contains: [...(container.contains ?? []), objectId],
			},
		},
		player: {
			...state.player,
			inventory: state.player.inventory.filter((id) => id !== objectId),
		},
	};
}

// ─── State Setters ───────────────────────────────────────────────────────────

export function setObjectState(
	state: GameState,
	objectId: string,
	key: string,
	value: boolean | string | number,
): GameState {
	const obj = state.objects[objectId];
	if (!obj) {
		throw new Error(`Object "${objectId}" does not exist`);
	}

	return {
		...state,
		objects: {
			...state.objects,
			[objectId]: {
				...obj,
				flags: { ...obj.flags, [key]: value },
			},
		},
	};
}

export function setRoomState(
	state: GameState,
	roomId: string,
	key: string,
	value: boolean | string | number,
): GameState {
	const room = state.rooms[roomId];
	if (!room) {
		throw new Error(`Room "${roomId}" does not exist`);
	}

	return {
		...state,
		rooms: {
			...state.rooms,
			[roomId]: {
				...room,
				flags: { ...room.flags, [key]: value },
			},
		},
	};
}

export function setPlayerState(
	state: GameState,
	key: string,
	value: boolean | string | number,
): GameState {
	return {
		...state,
		player: {
			...state.player,
			state: {
				...state.player.state,
				[key]: value,
			},
		},
	};
}

// ─── Player Movement ─────────────────────────────────────────────────────────

export function movePlayer(state: GameState, roomId: string): GameState {
	return {
		...state,
		player: {
			...state.player,
			current_room: roomId,
		},
	};
}

export function ensureVisited(state: GameState, roomId: string): GameState {
	const room = state.rooms[roomId];
	if (room.flags.visited) return state;

	return setRoomState(state, roomId, "visited", true);
}
