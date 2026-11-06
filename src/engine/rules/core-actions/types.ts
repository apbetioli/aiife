export type { ActionDef, ActionDefSchemaOnly, IntentMeta, StoppableEventLike } from "../types";

export type ResolveTargetOptions = {
	presence?: "any" | "inRoom" | "roomOrInventory";
};
