import type { z } from "zod";
import type { RecognizedIntent } from "../../agent/types";
import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { CoreEventName } from "./core-actions";
import type { EventBus } from "./event-bus";

export type { GameState };

// ─── Event Names & Params ────────────────────────────────────────────────────

/** Core names get autocomplete; custom names accepted via `(string & {})`. */
export type EventName = CoreEventName | (string & {});

/** Same shape as LLM intent recognition output minus the action name (each action uses a subset); validated at runtime. */
export type EventParams = Partial<Omit<RecognizedIntent, "action">>;

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
	stop(): void;
};

/** Event passed to action handlers; params are typed per action from the action's schema. */
export type StoppableEventLike<TParams = Record<string, unknown>> = {
	params: TParams;
	stop(): void;
};

// biome-ignore lint/suspicious/noConfusingVoidType: void return type is valid
export type EventListenerResult = string | string[] | undefined | void;

/** Listeners receive state (mutate in place inside produce). Return optional feedback (string or string[]). */
export type EventListener<N extends EventName> = (
	event: StoppableEvent<N>,
	state: GameState,
	world: World,
) => EventListenerResult;

export type Observer = (event: GameEvent, result?: EventListenerResult) => void;

export type ListenerScope = "global" | "scoped";

export interface ListenerRegistration<N extends EventName = EventName> {
	scope: ListenerScope;
	scopeId?: string;
	event: N;
	listener: EventListener<N>;
	priority: number;
	once: boolean;
}

// ─── Action Definitions ──────────────────────────────────────────────────────

/** Metadata the intent-recognition prompt builder uses to generate the alias table and action catalog. */
export type IntentMeta = {
	description: string;
	aliases?: string[];
	hint?: string;
};

/** One action definition: schema infers params type for the handler. Handler mutates state; returns optional feedback. */
export type ActionDef<TParams = Record<string, unknown>> = {
	schema: z.ZodType<TParams>;
	description: string;
	handler: (event: StoppableEventLike<TParams>, state: GameState, world: World, bus: EventBus) => EventListenerResult;
	/** Verb synonyms / shorthands that map player input to this action. */
	aliases?: string[];
	/** Disambiguation hint shown alongside aliases in the prompt (for patterns that aren't simple verb synonyms). */
	hint?: string;
	/** Optional bus listener priority (defaults to PRIORITY.MUTATION = 100). */
	priority?: number;
};

/** @deprecated Use ActionDef with a handler instead. */
export type ActionDefSchemaOnly<TParams> = {
	schema: z.ZodType<TParams>;
	description: string;
	aliases?: string[];
	hint?: string;
};
