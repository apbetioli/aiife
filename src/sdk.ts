// ─── AIIFE Game Authoring SDK ─────────────────────────────────────────────────

export {
	ensureVisited,
	findOpenContainerInRoom,
	getInventory,
	getObjectsInContainer,
	getObjectsInRoom,
	immutable,
	isInInventory,
	isInRoom,
	isInScope,
	moveObject,
	moveObjectFromContainerToInventory,
	moveObjectFromInventoryToContainer,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	moveObjectToContainer,
	movePlayer,
	setObjectState,
	setPlayerState,
	setRoomState,
} from "./engine/mutators";
export {
	type ActionDef,
	type ActionExecutionContext,
	ActionRegistry,
	type ActionScopeCondition,
	type ActionScopeRule,
	EventBus,
	evaluateActionScope,
	GameEvent,
	type GameSetup,
	type IntentMeta,
	registerAction,
	type StoppableEvent,
} from "./engine/rules";
export { getInstrument, getObjectIds, getTarget, runAction } from "./engine/rules/core-actions/helpers";
export { registerDaemon } from "./engine/rules/factories";
export { PRIORITY } from "./engine/rules/priorities";
export type { GameState, ObjectState, PlayerState, RoomState } from "./engine/types";
export { defineGame, type GameDefinition } from "./world/define-game";
export type { Direction, Exit, GameObject, ObjectType, Room, State, World } from "./world/types";
