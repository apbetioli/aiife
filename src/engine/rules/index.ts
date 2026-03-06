import type { World } from "../../world/types";
import { ActionRegistry } from "./action-registry";
import { registerCoreActions } from "./core-actions";
import { EventBus } from "./event-bus";
import { registerContainer } from "./factories";

export { ActionRegistry } from "./action-registry";
export { EventBus } from "./event-bus";
export { executeAction, executeUntrustedAction } from "./executor";

/** Optional setup function that game modules can export to register custom actions/listeners. */
export type GameSetup = (bus: EventBus, registry: ActionRegistry) => void;

/**
 * Create an EventBus and ActionRegistry pre-configured with core handlers
 * and world-specific factories derived from the world definition.
 */
export function createRules(
	world: World,
	setup?: GameSetup,
): {
	bus: EventBus;
	registry: ActionRegistry;
} {
	const bus = new EventBus();
	const registry = new ActionRegistry();

	registerCoreActions(bus, registry);

	// Auto-register containers
	for (const [id, obj] of Object.entries(world.objects)) {
		if (obj.type === "container") {
			registerContainer(bus, id);
		}
	}

	// Run game-specific setup
	setup?.(bus, registry);

	return { bus, registry };
}
