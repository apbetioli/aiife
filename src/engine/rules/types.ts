import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { CoreEventName, CoreEventParamsMap } from "./action-registry";

// ─── Event Names & Params ────────────────────────────────────────────────────

/** Core names get autocomplete; custom names accepted via `(string & {})`. */
export type EventName = CoreEventName | (string & {});

/** Resolves params for core events; custom events get `Record<string, unknown>`. */
export type EventParamsFor<N extends string> =
	N extends CoreEventName ? CoreEventParamsMap[N] : Record<string, unknown>;

// ─── Event ───────────────────────────────────────────────────────────────────

export class GameEvent<N extends EventName = EventName> {
	constructor(
		readonly name: N,
		readonly params: EventParamsFor<N & string>,
	) {}
}

// ─── Listener ────────────────────────────────────────────────────────────────

export type ListenerResult = {
	state: GameState;
	cancel?: string;
	feedback?: string[];
};

export type EventListener<N extends EventName> = (
	event: GameEvent<N>,
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
