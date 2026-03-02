import type { Direction, World } from "../../world/types";
import type { GameState } from "../types";
import type { IntentParams } from "./param-helpers";


// ─── Discriminated Params ────────────────────────────────────────────────────

// TODO these input schemas should come from the action registry
export type EventParamsMap = {
	go: { direction: Direction; from: string; to: string };
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
export type EventPhase = "before" | "on" | "after";

/** Runtime set of valid event names — kept in sync via `satisfies`. */
const eventNames = [
	"go", "take", "drop", "open", "close", "unlock", "lock",
	"examine", "use", "move", "attack", "talk",
	"enter", "exit", "tick", "game:start", "game:end",
] as const satisfies readonly EventName[];

const eventNameSet: ReadonlySet<string> = new Set(eventNames);

export function isEventName(name: string): name is EventName {
	return eventNameSet.has(name);
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface GameEvent<N extends EventName> {
	name: N;
	phase: EventPhase;
	params: EventParamsMap[N];
	cancelled: boolean;
	cancelReason?: string;
	feedback: string[];
}

// ─── Listener ────────────────────────────────────────────────────────────────

export type EventListener<N extends EventName> = (
	event: GameEvent<N>,
	state: GameState,
	world: World,
) => GameState;

export type ListenerScope = "global" | "room" | "object";

export interface ListenerRegistration<N extends EventName = EventName> {
	scope: ListenerScope;
	scopeId?: string;
	event: N;
	phase: EventPhase;
	listener: EventListener<N>;
	priority: number;
	once: boolean;
}
