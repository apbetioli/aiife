import {
	ensureVisited,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
} from "../mutators";
import type { EventBus } from "./event-bus";

const MUTATION_PRIORITY = 100;

export function registerCoreListeners(bus: EventBus): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"take",
		(event, state, _world) => {
			return moveObjectFromRoomToInventory(state, event.params.target);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── drop ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"drop",
		(event, state, _world) => {
			return moveObjectFromInventoryToRoom(
				state,
				event.params.target,
				state.player.current_room,
			);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── open ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"open",
		(event, state, _world) => {
			return setObjectState(state, event.params.target, "open", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── close ─────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"close",
		(event, state, _world) => {
			return setObjectState(state, event.params.target, "open", false);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── unlock ────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"unlock",
		(event, state, _world) => {
			return setObjectState(state, event.params.target, "locked", false);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── lock ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"lock",
		(event, state, _world) => {
			return setObjectState(state, event.params.target, "locked", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── examine ───────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"examine",
		(event, state, _world) => {
			return setObjectState(state, event.params.target, "examined", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── go ────────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"go",
		(event, state, _world) => {
			let s = movePlayer(state, event.params.to);
			s = ensureVisited(s, event.params.to);
			return s;
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── tick ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"tick",
		(_event, state, _world) => {
			const moves = (state.player.state.moves as number) ?? 0;
			return setPlayerState(state, "moves", moves + 1);
		},
		{ priority: MUTATION_PRIORITY },
	);
}
