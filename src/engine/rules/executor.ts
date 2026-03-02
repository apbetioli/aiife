import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { EventBus } from "./event-bus";
import type { EventName, EventParamsMap, GameEvent } from "./types";

export interface ExecuteResult {
	state: GameState;
	feedback: string[];
	cancelled: boolean;
}

export function executeAction<N extends EventName>(
	bus: EventBus,
	world: World,
	state: GameState,
	action: N,
	params: EventParamsMap[N],
): ExecuteResult {
	const event: GameEvent<N> = {
		name: action,
		phase: "before",
		params,
		cancelled: false,
		feedback: [],
	};

	// ── Before phase (guards/validation) ──────────────────────────────────
	event.phase = "before";
	const beforeResult = bus.emit(event, world, state);
	let currentState = beforeResult.state;

	if (event.cancelled) {
		if (event.cancelReason) event.feedback.push(event.cancelReason);
		return { state: currentState, feedback: event.feedback, cancelled: true };
	}

	// ── On phase (state mutations) ────────────────────────────────────────
	event.phase = "on";
	const onResult = bus.emit(event, world, currentState);
	currentState = onResult.state;

	// Special: go fires exit/enter sub-events
	if (action === "go") {
		const goParams = params as EventParamsMap["go"];

		const exitResult = executeAction(bus, world, currentState, "exit", {
			room: goParams.from,
		});
		currentState = exitResult.state;
		event.feedback.push(...exitResult.feedback);

		const enterResult = executeAction(bus, world, currentState, "enter", {
			room: goParams.to,
		});
		currentState = enterResult.state;
		event.feedback.push(...enterResult.feedback);
	}

	// ── After phase (side-effects/descriptions) ───────────────────────────
	event.phase = "after";
	const afterResult = bus.emit(event, world, currentState);
	currentState = afterResult.state;

	return { state: currentState, feedback: event.feedback, cancelled: false };
}
