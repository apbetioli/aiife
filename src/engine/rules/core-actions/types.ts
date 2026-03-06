import { z } from "zod";
import type { World } from "../../../world/types";
import type { GameState } from "../../types";
import type { ActionRegistry } from "../action-registry";
import { executeAction } from "../executor";
import type { EventBus } from "../event-bus";
import { getTarget, getInstrument, getObjectIds } from "../param-helpers";
import { isInInventory, isInRoom } from "../../mutators";

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

/** Resolve target object from event.params (uses objects[0]); returns null and stops if missing. */
export function resolveTarget<TParams extends { objects?: string[] }>(
	event: StoppableEventLike<TParams>,
	state: GameState,
	world: World,
	options: ResolveTargetOptions,
): {
	targetId: string;
	obj: NonNullable<World["objects"][string]>;
	objState: NonNullable<GameState["objects"][string]>;
} | null {
	const { missingMessage, notHereMessage = "You don't see that here.", presence = "roomOrInventory" } = options;
	const targetId = getTarget(event.params as { objects?: string[] });
	if (!targetId) {
		event.stop(missingMessage);
		return null;
	}
	const obj = world.objects[targetId];
	const objState = state.objects[targetId];
	if (!obj || !objState) {
		event.stop(notHereMessage);
		return null;
	}
	if (presence === "inRoom" && !isInRoom(state, targetId)) {
		event.stop(notHereMessage);
		return null;
	}
	if (presence === "roomOrInventory" && !isInRoom(state, targetId) && !isInInventory(state, targetId)) {
		event.stop(notHereMessage);
		return null;
	}
	return { targetId, obj, objState };
}

export function runAction(
	bus: EventBus,
	world: World,
	state: GameState,
	action: string,
	params: Record<string, unknown>,
) {
	return executeAction(bus, world, state, action, params);
}

export { getTarget, getInstrument, getObjectIds };

export function normalizeHandlerResult(raw: ListenerResult | GameState): ListenerResult {
	return "player" in raw ? { state: raw as GameState } : (raw as ListenerResult);
}

export function registerCoreActions(bus: EventBus, registry: ActionRegistry, definitions: Record<string, ActionDef<unknown>>): void {
	for (const [name, def] of Object.entries(definitions)) {
		registry.register(name, { schema: def.schema, description: def.description });
		if (def.handler) {
			const handler = def.handler;
			bus.on(name, (event, state, world) =>
				normalizeHandlerResult(handler(event as StoppableEventLike<unknown>, state, world, bus)),
			);
		}
	}
}
