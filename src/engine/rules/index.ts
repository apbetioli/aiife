import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";

export { ActionRegistry } from "./action-registry";
export type { ActionDef, IntentMeta, StoppableEventLike } from "./core-actions/types";
export { EventBus } from "./event-bus";
export { executeAction, executeUntrustedAction } from "./executor";
export { registerAction } from "./register-action";

/** Optional setup function that game modules can export to register custom actions/listeners. */
export type GameSetup = (bus: EventBus, registry: ActionRegistry) => void;
