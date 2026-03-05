import type { World } from "../../world/types";
import { ActionRegistry } from "./action-registry";
import { registerCoreHandlers } from "./core-listeners";
import { EventBus } from "./event-bus";
import { registerContainer } from "./factories";

export type { CoreEventName, CoreEventParamsMap } from "./action-registry";
export { ActionRegistry } from "./action-registry";
export { registerCoreHandlers } from "./core-listeners";
export type { EmitResult } from "./event-bus";
export { EventBus } from "./event-bus";
export type { ExecuteResult } from "./executor";
export { executeAction, executeUntrustedAction } from "./executor";
export {
	registerContainer,
	registerDaemon,
	registerRoomEvent,
} from "./factories";
export { PRIORITY } from "./priorities";
export type {
	EventListener,
	EventName,
	EventParamsFor,
	GameEvent,
	ListenerRegistration,
	ListenerResult,
	ListenerScope,
} from "./types";

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

	registerCoreHandlers(bus, registry);

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
