import type { z } from "zod";
import type { World } from "../../../world/types";
import type { GameState } from "../../types";
import type { EventBus } from "../event-bus";
import type { EventListenerResult } from "../types";

/** Event passed to handlers; params are typed per action from the action's schema. */
export type StoppableEventLike<TParams = Record<string, unknown>> = {
	params: TParams;
	stop(): void;
};

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
	handler?: (event: StoppableEventLike<TParams>, state: GameState, world: World, bus: EventBus) => EventListenerResult;
	/** Verb synonyms / shorthands that map player input to this action. */
	aliases?: string[];
	/** Disambiguation hint shown alongside aliases in the prompt (for patterns that aren't simple verb synonyms). */
	hint?: string;
};

/** Schema-only (no handler), e.g. enter/exit. */
export type ActionDefSchemaOnly<TParams> = {
	schema: z.ZodType<TParams>;
	description: string;
	aliases?: string[];
	hint?: string;
};

export type ResolveTargetOptions = {
	presence?: "any" | "inRoom" | "roomOrInventory";
};
