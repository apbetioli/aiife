// ─── AIIFE Game Authoring SDK ─────────────────────────────────────────────────

export { splitCommands, tryDeterministicIntent } from "./agent/fast-path-parser";
export {
	ensureVisited,
	findOpenContainerInRoom,
	getDescriptionMode,
	getInventory,
	getObjectsInContainer,
	getObjectsInRoom,
	immutable,
	isInInventory,
	isInRoom,
	isInScope,
	moveObject,
	movePlayer,
	setDescriptionMode,
	setObjectState,
	setPlayerState,
	setRoomState,
} from "./engine/mutators";
export {
	type ActionDef,
	type ActionExecutionContext,
	type ActionPack,
	ActionRegistry,
	type ActionScopeCondition,
	type ActionScopeRule,
	EventBus,
	evaluateActionScope,
	GameEvent,
	type GameSetup,
	registerAction,
	registerActionPack,
	registerActionPacks,
	type StoppableEvent,
} from "./engine/rules";
export {
	itemActions,
	navigationActions,
	socialActions,
	standardAdventureActions,
	systemActions,
} from "./engine/rules/core-actions";
export { getInstrument, getObjectIds, getTarget, runAction } from "./engine/rules/core-actions/helpers";
export { registerDaemon } from "./engine/rules/factories";
export { PRIORITY } from "./engine/rules/priorities";
export {
	addScore,
	calculateMaxScore,
	calculateScore,
	getScore,
	isDepositedInTrophy,
	isPossessedByPlayer,
	isTrophyLocation,
	syncScore,
} from "./engine/score";
export {
	type DescriptionMode,
	DescriptionModeSchema,
	type GameState,
	type ObjectState,
	type PlayerState,
	type RoomState,
} from "./engine/types";
export { defineGame, type GameDefinition } from "./world/define-game";
export type { Direction, Exit, GameObject, ObjectType, Room, State, World } from "./world/types";
