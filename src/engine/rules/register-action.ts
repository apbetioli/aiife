import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import type { ActionDef, StoppableEventLike } from "./types";

/**
 * Registers an action definition with both the ActionRegistry (for validation and LLM prompts)
 * and the EventBus (for execution).
 *
 * Returns an unregister cleanup function.
 */
export function registerAction<TParams = Record<string, unknown>>(
	bus: EventBus,
	registry: ActionRegistry,
	name: string,
	def: ActionDef<TParams>,
): () => void {
	registry.register(name, {
		schema: def.schema,
		description: def.description,
		aliases: def.aliases,
		hint: def.hint,
	});

	const handler = def.handler;
	const unbindBus = bus.on(
		name,
		(event, state, world) => handler(event as unknown as StoppableEventLike<TParams>, state, world, bus),
		def.priority !== undefined ? { priority: def.priority } : undefined,
	);

	return () => {
		registry.unregister(name);
		unbindBus();
	};
}
