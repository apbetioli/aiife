import type { Direction, World } from "../../world/types";
import type { GameState } from "../types";

// ─── Event Names ─────────────────────────────────────────────────────────────

export type EventName =
	| "go"
	| "take"
	| "drop"
	| "open"
	| "close"
	| "unlock"
	| "lock"
	| "examine"
	| "use"
	| "move"
	| "attack"
	| "talk"
	| "enter"
	| "exit"
	| "tick"
	| "game:start"
	| "game:end";

export type EventPhase = "before" | "on" | "after";

// ─── Discriminated Params ────────────────────────────────────────────────────

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
