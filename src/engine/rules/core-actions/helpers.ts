import type { World } from "../../../world/types";
import { findOpenContainerInRoom, isInRoom, isInScope } from "../../mutators";
import type { GameState } from "../../types";
import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { executeAction } from "../executor";
import { getInstrument, getObjectIds, getTarget } from "../param-helpers";
import { registerAction } from "../register-action";
import type { ActionDef, ResolveTargetOptions, StoppableEventLike } from "./types";

export { getInstrument, getObjectIds, getTarget };

export function resolveTarget<TParams extends { objects?: string[] }>(
	event: StoppableEventLike<TParams>,
	state: GameState,
	world: World,
	options: ResolveTargetOptions = {},
): {
	targetId: string;
	obj: NonNullable<World["objects"][string]>;
	objState: NonNullable<GameState["objects"][string]>;
} | null {
	const { presence = "roomOrInventory" } = options;
	const targetId = getTarget(event.params as { objects?: string[] });
	if (!targetId) {
		return null;
	}
	const obj = world.objects[targetId];
	const objState = state.objects[targetId];
	if (!obj || !objState) {
		return null;
	}
	if (presence === "inRoom") {
		const containerId = findOpenContainerInRoom(state, targetId);
		const inRoom = isInRoom(state, targetId) || (containerId ? isInRoom(state, containerId) : false);
		if (!inRoom) {
			return null;
		}
	}
	if (presence === "roomOrInventory" && !isInScope(state, targetId)) {
		return null;
	}
	return { targetId, obj, objState };
}

export function runAction(
	bus: EventBus,
	world: World,
	state: GameState,
	action: string,
	params: Record<string, unknown>,
) {
	return executeAction(bus, world, state, action, params).feedback;
}

export function registerCoreActions(
	bus: EventBus,
	registry: ActionRegistry,
	definitions: Record<string, ActionDef<unknown>>,
): void {
	for (const [name, def] of Object.entries(definitions)) {
		registerAction(bus, registry, name, def);
	}
}
