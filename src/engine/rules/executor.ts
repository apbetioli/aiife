import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { ActionRegistry } from "./action-registry";
import type { EmitResult, EventBus } from "./event-bus";
import { type EventName, type EventParams, GameEvent } from "./types";

type ExecuteResult = EmitResult;

export function executeAction<N extends EventName>(
	bus: EventBus,
	world: World,
	state: GameState,
	action: N,
	params: EventParams,
): ExecuteResult {
	return bus.emit(new GameEvent(action, params), world, state);
}

export function executeUntrustedAction(
	bus: EventBus,
	registry: ActionRegistry,
	world: World,
	state: GameState,
	action: string,
	params: Record<string, unknown>,
): ExecuteResult {
	const result = registry.safeParse(action, params);
	if (!result.success) {
		return {
			state,
			feedback: [result.error.issues.map((i) => i.message).join("\n")],
			stopped: true,
		};
	}
	return bus.emit(new GameEvent(action, result.data as Record<string, unknown>), world, state);
}
