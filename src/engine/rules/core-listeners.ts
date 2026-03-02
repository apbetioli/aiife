import {
	ensureVisited,
	isInInventory,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
} from "../mutators";
import { evaluateCondition } from "../parser-context";
import type { EventBus } from "./event-bus";
import { executeAction } from "./executor";
import { getInstrument, getTarget } from "./param-helpers";
import { PRIORITY } from "./priorities";

export function registerCoreHandlers(bus: EventBus): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.on("take", (event, state, world) => {
		const target = getTarget(event.params);
		if (isInInventory(state, target))
			return { state, cancel: "You're already carrying that." };
		if (!world.objects[target]?.carriable)
			return { state, cancel: "You can't take that." };
		return { state: moveObjectFromRoomToInventory(state, target) };
	}, { priority: PRIORITY.MUTATION });

	// ── drop ──────────────────────────────────────────────────────────────

	bus.on("drop", (event, state, _world) => {
		return {
			state: moveObjectFromInventoryToRoom(
				state,
				getTarget(event.params),
				state.player.current_room,
			),
		};
	}, { priority: PRIORITY.MUTATION });

	// ── open ──────────────────────────────────────────────────────────────

	bus.on("open", (event, state, _world) => {
		const target = getTarget(event.params);
		const objState = state.objects[target];
		if (objState?.flags.locked === true)
			return { state, cancel: "It's locked." };
		if (objState?.flags.open === true)
			return { state, cancel: "It's already open." };
		return { state: setObjectState(state, target, "open", true) };
	}, { priority: PRIORITY.MUTATION });

	// ── close ─────────────────────────────────────────────────────────────

	bus.on("close", (event, state, _world) => {
		const target = getTarget(event.params);
		const objState = state.objects[target];
		if (objState?.flags.open === false)
			return { state, cancel: "It's already closed." };
		return { state: setObjectState(state, target, "open", false) };
	}, { priority: PRIORITY.MUTATION });

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
	}, { priority: PRIORITY.MUTATION });

	// ── lock ──────────────────────────────────────────────────────────────

	bus.on("lock", (event, state, _world) => {
		return { state: setObjectState(state, getTarget(event.params), "locked", true) };
	}, { priority: PRIORITY.MUTATION });

	// ── examine ───────────────────────────────────────────────────────────

	bus.on("examine", (event, state, _world) => {
		return { state: setObjectState(state, getTarget(event.params), "examined", true) };
	}, { priority: PRIORITY.MUTATION });

	// ── go ────────────────────────────────────────────────────────────────

	bus.on("go", (event, state, world) => {
		const room = world.rooms[state.player.current_room];
		const exit = room?.exits[event.params.direction];
		if (!exit)
			return { state, cancel: "You can't go that way." };
		if (exit.condition && !evaluateCondition(exit.condition, state))
			return { state, cancel: exit.locked_message ?? "The way is blocked." };

		const from = state.player.current_room;
		const to = exit.leads_to;
		let s = movePlayer(state, to);
		s = ensureVisited(s, to);
		s = executeAction(bus, world, s, "exit", { room: from }).state;
		s = executeAction(bus, world, s, "enter", { room: to }).state;
		return { state: s };
	}, { priority: PRIORITY.MUTATION });

	// ── tick ──────────────────────────────────────────────────────────────

	bus.on("tick", (_event, state, _world) => {
		const moves = (state.player.state.moves as number) ?? 0;
		return { state: setPlayerState(state, "moves", moves + 1) };
	}, { priority: PRIORITY.MUTATION });
}
