import type { ActionRegistry } from "./action-registry";
import type { ActionDef, StoppableEventLike } from "./core-actions/types";
import type { EventBus } from "./event-bus";

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

	let unbindBus: (() => void) | undefined;
	if (def.handler) {
		const handler = def.handler;
		unbindBus = bus.on(
			name,
			(event, state, world) => handler(event as unknown as StoppableEventLike<TParams>, state, world, bus),
			def.priority !== undefined ? { priority: def.priority } : undefined,
		);
	}

	return () => {
		registry.unregister(name);
		unbindBus?.();
	};
}
