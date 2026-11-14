import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import type { ActionDef } from "./types";

const registryCleanups = new WeakMap<ActionRegistry, Map<string, () => void>>();

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
	if (!def.inputSchema) {
		throw new Error(`Action "${name}" must provide "inputSchema"`);
	}

	let cleanups = registryCleanups.get(registry);
	if (!cleanups) {
		cleanups = new Map();
		registryCleanups.set(registry, cleanups);
	}

	// If an existing action with the same name was registered via registerAction on this registry,
	// clean up the previous handler so re-registering an action overrides it cleanly.
	const existingCleanup = cleanups.get(name);
	if (existingCleanup) {
		existingCleanup();
	}

	registry.register(name, {
		inputSchema: def.inputSchema,
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

	const cleanup = () => {
		cleanups?.delete(name);
		registry.unregister(name);
		unbindBus();
	};

	cleanups.set(name, cleanup);
	return cleanup;
}
