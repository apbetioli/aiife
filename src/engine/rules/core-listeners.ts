import {
	ensureVisited,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
} from "../mutators";
import type { EventBus } from "./event-bus";
import { getTarget } from "./param-helpers";

const MUTATION_PRIORITY = 100;

export function registerCoreListeners(bus: EventBus): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"take",
		(event, state, _world) => {
			return moveObjectFromRoomToInventory(state, getTarget(event.params));
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
				getTarget(event.params),
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
			return setObjectState(state, getTarget(event.params), "open", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── close ─────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"close",
		(event, state, _world) => {
			return setObjectState(state, getTarget(event.params), "open", false);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── unlock ────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"unlock",
		(event, state, _world) => {
			return setObjectState(state, getTarget(event.params), "locked", false);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── lock ──────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"lock",
		(event, state, _world) => {
			return setObjectState(state, getTarget(event.params), "locked", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── examine ───────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"examine",
		(event, state, _world) => {
			return setObjectState(state, getTarget(event.params), "examined", true);
		},
		{ priority: MUTATION_PRIORITY },
	);

	// ── go ────────────────────────────────────────────────────────────────

	bus.onGlobal(
		"on",
		"go",
		(event, state, _world) => {
			const to = event.params.to as string;
			let s = movePlayer(state, to);
			s = ensureVisited(s, to);
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
