import {
	ensureVisited,
	isInInventory,
	isInRoom,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
} from "../mutators";
import { evaluateCondition, resolveRoomDescription } from "../parser-context";
import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import { executeAction } from "./executor";
import { getInstrument, getTarget } from "./param-helpers";

export function registerCoreHandlers(
	bus: EventBus,
	registry: ActionRegistry,
): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.on("take", (event, state, world) => {
		const ids = (event.params.objects ?? [])
			.map((s) => String(s).trim())
			.filter(Boolean);
		const toTake = ids.filter(
			(id) =>
				isInRoom(state, id) &&
				world.objects[id]?.carriable &&
				!isInInventory(state, id),
		);
		if (ids.length === 0) return { state, cancel: "Take what?" };
		if (toTake.length === 0) {
			if (ids.some((id) => isInInventory(state, id)))
				return { state, cancel: "You're already carrying that." };
			return { state, cancel: "You can't take that." };
		}
		let nextState = state;
		for (const id of toTake) {
			nextState = moveObjectFromRoomToInventory(nextState, id);
		}
		return { state: nextState };
	});

	// ── drop ──────────────────────────────────────────────────────────────

	bus.on("drop", (event, state, _world) => {
		const ids = (event.params.objects ?? [])
			.map((s) => String(s).trim())
			.filter(Boolean);
		const toDrop = ids.filter((id) => isInInventory(state, id));
		if (toDrop.length === 0) {
			if (ids.length === 0) return { state, cancel: "Drop what?" };
			return { state, cancel: "You're not carrying any of those." };
		}
		const roomId = state.player.current_room;
		let nextState = state;
		for (const id of toDrop) {
			nextState = moveObjectFromInventoryToRoom(nextState, id, roomId);
		}
		return { state: nextState };
	});

	// ── open ──────────────────────────────────────────────────────────────

	bus.on("open", (event, state, _world) => {
		const target = getTarget(event.params);
		const objState = state.objects[target];
		if (objState?.flags.locked === true)
			return { state, cancel: "It's locked." };
		if (objState?.flags.open === true)
			return { state, cancel: "It's already open." };
		return { state: setObjectState(state, target, "open", true) };
	});

	// ── close ─────────────────────────────────────────────────────────────

	bus.on("close", (event, state, _world) => {
		const target = getTarget(event.params);
		const objState = state.objects[target];
		if (objState?.flags.open === false)
			return { state, cancel: "It's already closed." };
		return { state: setObjectState(state, target, "open", false) };
	});

	// ── unlock ────────────────────────────────────────────────────────────

	bus.on("unlock", (event, state, world) => {
		const target = getTarget(event.params);
		const instrument = getInstrument(event.params);
		if (!instrument || !isInInventory(state, instrument))
			return { state, cancel: "You don't have anything to unlock it with." };
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey)
			return { state, cancel: "That doesn't fit the lock." };
		return { state: setObjectState(state, target, "locked", false) };
	});

	// ── lock ──────────────────────────────────────────────────────────────

	bus.on("lock", (event, state, _world) => {
		return {
			state: setObjectState(state, getTarget(event.params), "locked", true),
		};
	});

	// ── examine ───────────────────────────────────────────────────────────

	bus.on("examine", (event, state, _world) => {
		return {
			state: setObjectState(state, getTarget(event.params), "examined", true),
		};
	});

	// ── go ────────────────────────────────────────────────────────────────

	bus.on("go", (event, state, world) => {
		const room = world.rooms[state.player.current_room];
		const exit = room?.exits[event.params.direction];
		if (!exit) return { state, cancel: "You can't go that way." };
		if (exit.condition && !evaluateCondition(exit.condition, state))
			return { state, cancel: exit.locked_message ?? "The way is blocked." };

		const from = state.player.current_room;
		const to = exit.leads_to;
		let s = movePlayer(state, to);
		s = ensureVisited(s, to);
		s = executeAction(bus, world, s, "exit", { room: from }).state;
		s = executeAction(bus, world, s, "enter", { room: to }).state;
		return { state: s };
	});

	// ── tick ──────────────────────────────────────────────────────────────

	bus.on("tick", (_event, state, _world) => {
		const moves = (state.player.state.moves as number) ?? 0;
		return { state: setPlayerState(state, "moves", moves + 1) };
	});

	// ── look ──────────────────────────────────────────────────────────────

	bus.on("look", (_event, state, world) => {
		const roomId = state.player.current_room;
		const room = world.rooms[roomId];
		const roomState = state.rooms[roomId];
		const description = resolveRoomDescription(room, roomState);

		const lines: string[] = [`**${room.name}**`, description];

		const objectNames = roomState.contains
			.map((id) => world.objects[id]?.name)
			.filter(Boolean);
		if (objectNames.length > 0) {
			lines.push(`You can see: ${objectNames.join(", ")}.`);
		}

		const exits = Object.entries(room.exits)
			.filter(
				([, exit]) =>
					!exit.condition || evaluateCondition(exit.condition, state),
			)
			.map(([dir]) => dir);
		if (exits.length > 0) {
			lines.push(`Exits: ${exits.join(", ")}.`);
		}

		return { state, feedback: [lines.join("\n")] };
	});

	// ── inventory ─────────────────────────────────────────────────────────

	bus.on("inventory", (_event, state, world) => {
		if (state.player.inventory.length === 0) {
			return { state, feedback: ["You aren't carrying anything."] };
		}
		const names = state.player.inventory.map(
			(id) => world.objects[id]?.name ?? id,
		);
		return { state, feedback: [`You are carrying: ${names.join(", ")}.`] };
	});

	// ── help ──────────────────────────────────────────────────────────────

	bus.on("help", (_event, state, _world) => {
		const descriptions = registry.getDescriptions();
		const lines = Object.values(descriptions).map((d) => `- ${d}`);
		return { state, feedback: ["Available commands:", ...lines] };
	});

	// ── quit ──────────────────────────────────────────────────────────────

	bus.on("quit", (_event, state, _world) => {
		return {
			state: setPlayerState(state, "quit", true),
			feedback: ["Goodbye!"],
		};
	});
}
