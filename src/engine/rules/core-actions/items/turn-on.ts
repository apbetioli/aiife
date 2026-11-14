import type { z } from "zod";
import { isInScope, setObjectState } from "../../../mutators";
import { getTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const turnOn: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["light", "switch on", "activate"],
	description: "turn_on(objects): Turn on or light a light source. objects: [target_id].",
	scope: (ctx) =>
		ctx.in_scope_objects.some(
			(o) => o.state?.lit === false || ["lantern", "lamp", "candle", "torch", "match"].some((k) => o.id.includes(k)),
		),
	execute: (params, { state, world, stop }) => {
		const target = getTarget(params as { objects?: string[] });
		if (!target) {
			stop();
			return "Turn on what?";
		}
		if (!isInScope(state, target)) {
			stop();
			return "You don't see that here.";
		}
		const obj = world.objects[target];
		const objState = state.objects[target];
		if (objState?.state.lit === true) {
			stop();
			return `The ${obj?.name ?? target} is already on.`;
		}
		setObjectState(state, target, "lit", true);
		return `The ${obj?.name ?? target} is now on.`;
	},
};
