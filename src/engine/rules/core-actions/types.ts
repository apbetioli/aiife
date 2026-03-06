import type { z } from "zod";
import type { World } from "../../../world/types";
import type { GameState } from "../../types";
import type { EventBus } from "../event-bus";

export type ListenerResult = { state: GameState; feedback?: string[] };

/** Event passed to handlers; params are typed per action from the action's schema. */
export type StoppableEventLike<TParams = Record<string, unknown>> = {
	params: TParams;
	stop(message?: string | string[]): void;
};

/** One action definition: schema infers params type for the handler. */
export type ActionDef<TParams = Record<string, unknown>> = {
	schema: z.ZodType<TParams>;
	description: string;
	handler?: (
		event: StoppableEventLike<TParams>,
		state: GameState,
		world: World,
		bus: EventBus,
	) => ListenerResult | GameState;
};

/** Schema-only (no handler), e.g. enter/exit. */
export type ActionDefSchemaOnly<TParams> = {
	schema: z.ZodType<TParams>;
	description: string;
};

export type ResolveTargetOptions = {
	missingMessage: string;
	notHereMessage?: string;
	presence?: "any" | "inRoom" | "roomOrInventory";
};
