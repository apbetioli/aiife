import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { EventBus } from "./event-bus";
import { PRIORITY } from "./priorities";
import type { EventName, GameEvent, ListenerResult } from "./types";

// ─── Container ───────────────────────────────────────────────────────────────

/**
 * When a container is opened, move its contents into the room scope.
 * When closed, move them back into the container.
 */
export function registerContainer(bus: EventBus, objectId: string): void {
	// On open: move contained items into the room
	bus.on(
		"open",
		objectId,
		(_event, state, _world) => {
			const container = state.objects[objectId];
			if (!container?.contains?.length) return { state };

			const roomId = state.player.current_room;
			const room = state.rooms[roomId];

			return {
				state: {
					...state,
					rooms: {
						...state.rooms,
						[roomId]: {
							...room,
							contains: [...room.contains, ...container.contains],
						},
					},
					objects: {
						...state.objects,
						[objectId]: {
							...container,
							contains: [],
						},
					},
				},
			};
		},
		{ priority: PRIORITY.POST_MUTATION },
	);

	// On close: move items back into the container
	bus.on(
		"close",
		objectId,
		(_event, state, world) => {
			const containerDef = world.objects[objectId];
			if (!containerDef?.contains?.length) return { state };

			const roomId = state.player.current_room;
			const room = state.rooms[roomId];
			const originalContents = containerDef.contains;

			// Only move back items that are still in the room
			const toReturn = originalContents.filter((id) => room.contains.includes(id));
			if (!toReturn.length) return { state };

			const container = state.objects[objectId];

			return {
				state: {
					...state,
					rooms: {
						...state.rooms,
						[roomId]: {
							...room,
							contains: room.contains.filter((id) => !toReturn.includes(id)),
						},
					},
					objects: {
						...state.objects,
						[objectId]: {
							...container,
							contains: [...(container.contains ?? []), ...toReturn],
						},
					},
				},
			};
		},
		{ priority: PRIORITY.POST_MUTATION },
	);
}

// ─── Room Event ──────────────────────────────────────────────────────────────

interface RoomEventOptions<N extends EventName> {
	priority?: number;
	once?: boolean;
	effect: (event: GameEvent<N>, state: GameState, world: World) => ListenerResult | GameState;
}

/**
 * Register a one-time or recurring event for a specific room.
 */
export function registerRoomEvent<N extends EventName>(
	bus: EventBus,
	roomId: string,
	event: N,
	options: RoomEventOptions<N>,
): () => void {
	return bus.on(event, roomId, options.effect, {
		priority: options.priority ?? PRIORITY.EFFECT,
		once: options.once ?? false,
	});
}

// ─── Daemon ──────────────────────────────────────────────────────────────────

interface DaemonOptions {
	condition: (world: World, state: GameState) => boolean;
	effect: (world: World, state: GameState) => GameState;
	priority?: number;
	feedback?: (world: World, state: GameState) => string | undefined;
}

/**
 * Register a global tick listener that checks a condition each turn
 * and applies an effect when met.
 */
export function registerDaemon(bus: EventBus, _name: string, options: DaemonOptions): () => void {
	return bus.on(
		"tick",
		(_event, state, world) => {
			if (!options.condition(world, state)) return { state };
			const newState = options.effect(world, state);
			const msg = options.feedback?.(world, newState);
			return {
				state: newState,
				feedback: msg ? [msg] : undefined,
			};
		},
		{ priority: options.priority ?? PRIORITY.DAEMON },
	);
}
