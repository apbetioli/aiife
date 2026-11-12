import type { World } from "../../../world/types";
import { findOpenContainerInRoom, isInRoom, isInScope } from "../../mutators";
import type { GameState } from "../../types";
import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { executeAction } from "../executor";
import { getInstrument, getObjectIds, getTarget } from "../param-helpers";
import { registerAction } from "../register-action";
import type { ActionDef, ActionPack, ResolveTargetOptions } from "./types";

export { getInstrument, getObjectIds, getTarget };

export function resolveTarget<TParams extends { objects?: string[] }>(
	params: TParams,
	state: GameState,
	world: World,
	options: ResolveTargetOptions = {},
): {
	targetId: string;
	obj: NonNullable<World["objects"][string]>;
	objState: NonNullable<GameState["objects"][string]>;
} | null {
	const { presence = "roomOrInventory" } = options;
	const targetId = getTarget(params as { objects?: string[] });
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
	const result = executeAction(bus, world, state, action, params);
	Object.assign(state, result.state);
	return result.feedback;
}

export function registerActionPack(
	bus: EventBus,
	registry: ActionRegistry,
	...packs: (ActionPack | ActionPack[])[]
): void {
	for (const pack of packs.flat()) {
		if (typeof pack === "function") {
			pack(bus, registry);
		} else {
			for (const [name, def] of Object.entries(pack)) {
				registerAction(bus, registry, name, def);
			}
		}
	}
}

export const registerActionPacks = registerActionPack;

export function registerCoreActions(
	bus: EventBus,
	registry: ActionRegistry,
	// biome-ignore lint/suspicious/noExplicitAny: action definitions can have any parameter schema
	definitions: Record<string, ActionDef<any>> = {},
): void {
	registerActionPack(bus, registry, definitions);
}
