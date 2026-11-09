import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import type { ActionDef, EventListenerResult, StoppableEventLike } from "./types";

/**
 * Registers an action definition with both the ActionRegistry (for validation, scoping, and LLM tools)
 * and the EventBus (for execution).
 *
 * Supports both modern AI SDK tool style (`inputSchema`, `execute`) and classic style (`schema`, `handler`).
 *
 * Returns an unregister cleanup function.
 */
export function registerAction<TParams = Record<string, unknown>>(
	bus: EventBus,
	registry: ActionRegistry,
	name: string,
	def: ActionDef<TParams>,
): () => void {
	const schema = def.inputSchema ?? def.schema;
	if (!schema) {
		throw new Error(`Action "${name}" must provide either "inputSchema" or "schema"`);
	}

	registry.register(name, {
		inputSchema: schema,
		schema,
		description: def.description,
		aliases: def.aliases,
		hint: def.hint,
		scope: def.scope,
	});

	const hasExecute = typeof def.execute === "function";
	const handler:
		| ((event: StoppableEventLike<TParams>, state: GameState, world: World, bus: EventBus) => EventListenerResult)
		| undefined = hasExecute
		? (event, state, world, b) =>
				def.execute?.(event.params, {
					state,
					world,
					bus: b,
					stop: () => event.stop(),
				})
		: def.handler;

	const unbindBus = handler
		? bus.on(
				name,
				(event, state, world) => handler(event as unknown as StoppableEventLike<TParams>, state, world, bus),
				def.priority !== undefined ? { priority: def.priority } : undefined,
			)
		: () => {};

	return () => {
		registry.unregister(name);
		unbindBus();
	};
}
