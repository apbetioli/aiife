import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { CoreEventName, CoreEventParamsMap } from "./core-actions";

// ─── Event Names & Params ────────────────────────────────────────────────────

/** Core names get autocomplete; custom names accepted via `(string & {})`. */
export type EventName = CoreEventName | (string & {});

/** Resolves params for core events; custom events get `Record<string, unknown>`. */
export type EventParamsFor<N extends string> = N extends CoreEventName
	? CoreEventParamsMap[N]
	: Record<string, unknown>;

// ─── Event ───────────────────────────────────────────────────────────────────

export class GameEvent<N extends EventName = EventName> {
	constructor(
		readonly name: N,
		readonly params: EventParamsFor<N & string>,
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
