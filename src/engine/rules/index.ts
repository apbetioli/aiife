import type { World } from "../../world/types";
import { registerCoreHandlers } from "./core-listeners";
import { EventBus } from "./event-bus";
import { registerContainer } from "./factories";

export { registerCoreHandlers } from "./core-listeners";
export { EventBus } from "./event-bus";
export type { EmitResult } from "./event-bus";
export type { ExecuteResult } from "./executor";
export { executeAction } from "./executor";
export { PRIORITY } from "./priorities";
export {
	registerContainer,
	registerDaemon,
	registerRoomEvent,
} from "./factories";
export type {
	EventListener,
	EventName,
	EventParamsMap,
	GameEvent,
	ListenerRegistration,
	ListenerResult,
	ListenerScope,
} from "./types";
export { isEventName } from "./types";

/**
 * Create an EventBus pre-configured with core handlers
 * and world-specific factories derived from the world definition.
 */
export function createRules(world: World): EventBus {
	const bus = new EventBus();

	registerCoreHandlers(bus);

	// Auto-register containers
	for (const [id, obj] of Object.entries(world.objects)) {
		if (obj.type === "container") {
			registerContainer(bus, id);
		}
	}

	return bus;
}
