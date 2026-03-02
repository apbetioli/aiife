import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { EmitResult, EventBus } from "./event-bus";
import { type EventName, type EventParamsMap, GameEvent } from "./types";

export type ExecuteResult = EmitResult;

export function executeAction<N extends EventName>(
	bus: EventBus,
	world: World,
	state: GameState,
	action: N,
	params: EventParamsMap[N],
): ExecuteResult {
	return bus.emit(new GameEvent(action, params), world, state);
}
