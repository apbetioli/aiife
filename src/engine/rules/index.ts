import type { World } from "../../world/types";
import { registerCoreEffects } from "./core-effects";
import { registerCoreGuards } from "./core-guards";
import { registerCoreListeners } from "./core-listeners";
import { EventBus } from "./event-bus";
import { registerContainer, registerLockable } from "./factories";

export { registerCoreGuards } from "./core-guards";
export { registerCoreListeners } from "./core-listeners";
export { EventBus } from "./event-bus";
export type { ExecuteResult } from "./executor";
export { executeAction } from "./executor";
export {
	registerContainer,
	registerDaemon,
	registerLockable,
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

	// Auto-register lockables with requires_instrument
	for (const [id, obj] of Object.entries(world.objects)) {
		if (obj.requires_instrument?.unlock) {
			registerLockable(bus, id, obj.requires_instrument.unlock);
		}
	}

	return bus;
}
