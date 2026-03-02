import type { Direction } from "../../world/types";
import { isInInventory } from "../mutators";
import { evaluateCondition } from "../parser-context";
import type { EventBus } from "./event-bus";
import { getInstrument, getTarget } from "./param-helpers";

const GO_RESOLVE_PRIORITY = 0;
const GUARD_PRIORITY = 50;

export function registerCoreGuards(bus: EventBus): void {
	// ── go resolve (from/to from state/world) ───────────────────────────────

	bus.onGlobal(
		"before",
		"go",
		(event, state, world) => {
			const params = event.params;
			if (!params.direction) return state;
			if (params.to != null && params.to !== "") return state;

			const from = state.player.current_room;
			const room = world.rooms[from];
			const exit = room?.exits[params.direction as Direction];
			const to = exit?.leads_to ?? "";

			params.from = from;
			params.to = to;

			if (!exit) {
				event.cancelled = true;
				event.cancelReason = "You can't go that way.";
			}
			return state;
		},
		{ priority: GO_RESOLVE_PRIORITY },
	);

	// ── take ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"take",
		(event, state, _world) => {
			const target = getTarget(event.params);
			if (isInInventory(state, target)) {
				event.cancelled = true;
				event.cancelReason = "You're already carrying that.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY },
	);

	bus.onGlobal(
		"before",
		"take",
		(event, _state, world) => {
			const target = getTarget(event.params);
			const obj = world.objects[target];
			if (obj && !obj.carriable) {
				event.cancelled = true;
				event.cancelReason = "You can't take that.";
			}
			return _state;
		},
		{ priority: GUARD_PRIORITY },
	);

	// ── open ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"open",
		(event, state, _world) => {
			const target = getTarget(event.params);
			const objState = state.objects[target];
			if (objState?.flags.locked === true) {
				event.cancelled = true;
				event.cancelReason = "It's locked.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY },
	);

	bus.onGlobal(
		"before",
		"open",
		(event, state, _world) => {
			if (event.cancelled) return state;
			const target = getTarget(event.params);
			const objState = state.objects[target];
			if (objState?.flags.open === true) {
				event.cancelled = true;
				event.cancelReason = "It's already open.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY + 1 },
	);

	// ── close ─────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"close",
		(event, state, _world) => {
			const target = getTarget(event.params);
			const objState = state.objects[target];
			if (objState?.flags.open === false) {
				event.cancelled = true;
				event.cancelReason = "It's already closed.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY },
	);

	// ── unlock ────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"unlock",
		(event, state, _world) => {
			const instrument = getInstrument(event.params);
			if (!instrument || !isInInventory(state, instrument)) {
				event.cancelled = true;
				event.cancelReason = "You don't have anything to unlock it with.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY },
	);

	bus.onGlobal(
		"before",
		"unlock",
		(event, state, w) => {
			if (event.cancelled) return state;
			const target = getTarget(event.params);
			const instrument = getInstrument(event.params);
			const obj = w.objects[target];
			const requiredKey = obj?.requires_instrument?.unlock;
			if (requiredKey && instrument !== requiredKey) {
				event.cancelled = true;
				event.cancelReason = "That doesn't fit the lock.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY + 1 },
	);

	// ── go (validation after resolve) ────────────────────────────────────────

	bus.onGlobal(
		"before",
		"go",
		(event, state, world) => {
			const room = world.rooms[event.params.from as string];
			if (!room) {
				event.cancelled = true;
				event.cancelReason = "You can't go that way.";
				return state;
			}
			const exit = room.exits[event.params.direction as Direction];
			if (!exit) {
				event.cancelled = true;
				event.cancelReason = "You can't go that way.";
				return state;
			}
			if (exit.condition && !evaluateCondition(exit.condition, state)) {
				event.cancelled = true;
				event.cancelReason = exit.locked_message ?? "The way is blocked.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY },
	);
}
