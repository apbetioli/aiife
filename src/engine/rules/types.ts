import type { z } from "zod";
import type { RecognizedIntent } from "../../agent/types";
import type { ObjectType, ParserContext, World } from "../../world/types";
import type { GameState } from "../types";
import type { ActionRegistry } from "./action-registry";
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

/** Declarative scoping conditions for when an action/tool should be available. */
export type ActionScopeCondition = {
	/** Available only if the player is in one of these room IDs */
	rooms?: string[];
	/** Available only if at least one of these object IDs is in scope */
	objects?: string[];
	/** Available only if an object of this type is in scope (e.g. "actor", "container") */
	types?: ObjectType[];
	/** Custom condition predicate */
	when?: (context: ParserContext, state: GameState) => boolean;
};

/** When an action/tool is in scope. Defaults to "always". */
export type ActionScopeRule = "always" | ActionScopeCondition | ((context: ParserContext, state: GameState) => boolean);

/** Execution context passed to action `execute` handlers, matching AI SDK style. */
export type ActionExecutionContext = {
	state: GameState;
	world: World;
	bus: EventBus;
	stop: () => void;
};

type BaseActionDef = {
	description: string;
	/** Verb synonyms / shorthands that map player input to this action. */
	aliases?: string[];
	/** Disambiguation hint shown alongside aliases in the prompt (for patterns that aren't simple verb synonyms). */
	hint?: string;
	/** When this action is in scope / available as a tool. Defaults to "always". */
	scope?: ActionScopeRule;
	/** Optional bus listener priority (defaults to PRIORITY.MUTATION = 100). */
	priority?: number;
};

/** One action definition: inputSchema infers params type. Execute mutates state; returns optional feedback. */
// biome-ignore lint/suspicious/noExplicitAny: action definitions can have any parameter schema
export type ActionDef<TParams = any> = BaseActionDef & {
	/** AI SDK standard parameter schema. */
	inputSchema: z.ZodType<TParams>;

	/** AI SDK standard executor: `(params, context) => result`. */
	execute?: (params: TParams, context: ActionExecutionContext) => EventListenerResult;
};

/** A composable pack of action definitions or a setup function. */
// biome-ignore lint/suspicious/noExplicitAny: action definitions can have any parameter schema
export type ActionPack = Record<string, ActionDef<any>> | ((bus: EventBus, registry: ActionRegistry) => void);
