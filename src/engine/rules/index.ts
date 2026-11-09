import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";

export { type ActionEntry, ActionRegistry, evaluateActionScope } from "./action-registry";
export { EventBus } from "./event-bus";
export { executeAction, executeUntrustedAction } from "./executor";
export { registerAction } from "./register-action";
export {
	type ActionDef,
	type ActionDefSchemaOnly,
	type ActionExecutionContext,
	type ActionScopeCondition,
	type ActionScopeRule,
	type EventListener,
	type EventListenerResult,
	type EventName,
	type EventParams,
	GameEvent,
	type IntentMeta,
	type Observer,
	type StoppableEvent,
	type StoppableEventLike,
} from "./types";

/** Optional setup function that game modules can export to register custom actions/listeners. */
export type GameSetup = (bus: EventBus, registry: ActionRegistry) => void;
