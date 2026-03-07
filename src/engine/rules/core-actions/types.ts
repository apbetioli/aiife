import type { z } from "zod";
import type { World } from "../../../world/types";
import type { GameState } from "../../types";
import type { EventBus } from "../event-bus";

/** Event passed to handlers; params are typed per action from the action's schema. */
export type StoppableEventLike<TParams = Record<string, unknown>> = {
	params: TParams;
	stop(): void;
};

/** One action definition: schema infers params type for the handler. Handler mutates state; returns optional feedback. */
export type ActionDef<TParams = Record<string, unknown>> = {
	schema: z.ZodType<TParams>;
	description: string;
	handler?: (
		event: StoppableEventLike<TParams>,
		state: GameState,
		world: World,
		bus: EventBus,
		// biome-ignore lint/suspicious/noConfusingVoidType: void return type is valid
	) => string | string[] | undefined | void;
};

/** Schema-only (no handler), e.g. enter/exit. */
export type ActionDefSchemaOnly<TParams> = {
	schema: z.ZodType<TParams>;
	description: string;
};

export type ResolveTargetOptions = {
	presence?: "any" | "inRoom" | "roomOrInventory";
};
