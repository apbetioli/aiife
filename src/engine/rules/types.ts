import type { Direction, World } from "../../world/types";
import type { GameState } from "../types";

// ─── Discriminated Params ────────────────────────────────────────────────────

// TODO these input schemas should come from the action registry
export type EventParamsMap = {
	go: { direction: Direction };
	take: { target: string };
	drop: { target: string };
	open: { target: string };
	close: { target: string };
	unlock: { target: string; instrument?: string };
	lock: { target: string; instrument?: string };
	examine: { target: string };
	use: { target: string; indirect?: string };
	move: { target: string; direction?: string };
	attack: { target: string; instrument?: string };
	talk: { target: string };
	enter: { room: string };
	exit: { room: string };
	tick: Record<string, never>;
	"game:start": Record<string, never>;
	"game:end": { victory: boolean };
};

// ─── Event Names ─────────────────────────────────────────────────────────────

export type EventName = keyof EventParamsMap;

/** Runtime set of valid event names — kept in sync via `satisfies`. */
const eventNames = [
	"go",
	"take",
	"drop",
	"open",
	"close",
	"unlock",
	"lock",
	"examine",
	"use",
	"move",
	"attack",
	"talk",
	"enter",
	"exit",
	"tick",
	"game:start",
	"game:end",
] as const satisfies readonly EventName[];

const eventNameSet: ReadonlySet<string> = new Set(eventNames);

export function isEventName(name: string): name is EventName {
	return eventNameSet.has(name);
}

// ─── Event ───────────────────────────────────────────────────────────────────

export class GameEvent<N extends EventName> {
	constructor(
		readonly name: N,
		readonly params: EventParamsMap[N],
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
