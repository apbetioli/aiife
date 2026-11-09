import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import type { ActionDef } from "./types";

/**
 * Registers an action definition with both the ActionRegistry (for validation, scoping, and LLM tools)
 * and the EventBus (for execution).
 *
 * Uses AI SDK tool style: `inputSchema` (or `schema`) and `execute`.
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

	const unbindBus = def.execute
		? bus.on(
				name,
				(event, state, world) =>
					def.execute?.(event.params as TParams, {
						state,
						world,
						bus,
						stop: () => event.stop(),
					}),
				def.priority !== undefined ? { priority: def.priority } : undefined,
			)
		: () => {};

	return () => {
		registry.unregister(name);
		unbindBus();
	};
}
