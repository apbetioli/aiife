import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { StructuredOutput } from "../../agent/types";
import type { CoreEventName } from "./core-actions-types";

// ─── Event Names & Params ────────────────────────────────────────────────────

/** Core names get autocomplete; custom names accepted via `(string & {})`. */
export type EventName = CoreEventName | (string & {});

/** Same shape as LLM structured output minus the action name (each action uses a subset); validated at runtime. */
export type EventParams = Partial<Omit<StructuredOutput, "action">>;

// ─── Event ───────────────────────────────────────────────────────────────────

export class GameEvent<N extends EventName = EventName> {
	constructor(
		readonly name: N,
		readonly params: EventParams,
	) {}
}

// ─── Listener ────────────────────────────────────────────────────────────────

/** Event passed to listeners; call stop() to cancel propagation (message goes to feedback). */
export type StoppableEvent<N extends EventName> = GameEvent<N> & {
	stop(message?: string | string[]): void;
};

export type ListenerResult = {
	state: GameState;
	feedback?: string[];
};

export type EventListener<N extends EventName> = (
	event: StoppableEvent<N>,
	state: GameState,
	world: World,
) => ListenerResult | GameState;

export type ListenerScope = "global" | "scoped";

export interface ListenerRegistration<N extends EventName = EventName> {
	scope: ListenerScope;
	scopeId?: string;
	event: N;
	listener: EventListener<N>;
	priority: number;
	once: boolean;
}
