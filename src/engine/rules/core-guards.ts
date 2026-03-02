import type { Direction } from "../../world/types";
import { isInInventory } from "../mutators";
import { evaluateCondition } from "../parser-context";
import type { EventBus } from "./event-bus";

const GUARD_PRIORITY = 50;

export function registerCoreGuards(bus: EventBus): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"take",
		(event, state, _world) => {
			if (isInInventory(state, event.params.target)) {
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
			const obj = world.objects[event.params.target];
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
			const objState = state.objects[event.params.target];
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
			const objState = state.objects[event.params.target];
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
			const objState = state.objects[event.params.target];
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
			if (
				!event.params.instrument ||
				!isInInventory(state, event.params.instrument)
			) {
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
			const obj = w.objects[event.params.target];
			const requiredKey = obj?.requires_instrument?.unlock;
			if (requiredKey && event.params.instrument !== requiredKey) {
				event.cancelled = true;
				event.cancelReason = "That doesn't fit the lock.";
			}
			return state;
		},
		{ priority: GUARD_PRIORITY + 1 },
	);

	// ── go ────────────────────────────────────────────────────────────────

	bus.onGlobal(
		"before",
		"go",
		(event, state, world) => {
			const room = world.rooms[event.params.from];
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
