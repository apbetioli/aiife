import type { World } from "../../world/types";
import { registerCoreEffects } from "./core-effects";
import { registerCoreGuards } from "./core-guards";
import { registerCoreListeners } from "./core-listeners";
import { EventBus } from "./event-bus";
import { registerContainer } from "./factories";

export { registerCoreGuards } from "./core-guards";
export { registerCoreListeners } from "./core-listeners";
export { EventBus } from "./event-bus";
export type { ExecuteResult } from "./executor";
export { executeAction } from "./executor";
export {
	registerContainer,
	registerDaemon,
	registerRoomEvent,
} from "./factories";
export type {
	EventListener,
	EventName,
	EventParamsMap,
	EventPhase,
	GameEvent,
	ListenerRegistration,
	ListenerScope,
} from "./types";

/**
 * Create an EventBus pre-configured with core guards, core listeners,
 * and world-specific factories derived from the world definition.
 */
export function createRules(world: World): EventBus {
	const bus = new EventBus();

	registerCoreGuards(bus);
	registerCoreListeners(bus);
	registerCoreEffects(bus);

	// Auto-register containers
	for (const [id, obj] of Object.entries(world.objects)) {
		if (obj.type === "container") {
			registerContainer(bus, id);
		}
	}

	return bus;
}
