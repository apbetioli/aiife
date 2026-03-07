import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";

export { ActionRegistry } from "./action-registry";
export { EventBus } from "./event-bus";
export { executeAction, executeUntrustedAction } from "./executor";

/** Optional setup function that game modules can export to register custom actions/listeners. */
export type GameSetup = (bus: EventBus, registry: ActionRegistry) => void;
