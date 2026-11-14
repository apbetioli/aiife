import type { z } from "zod";
import { isInScope, setObjectState } from "../../../mutators";
import { getTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const turnOff: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["extinguish", "switch off", "deactivate"],
	description: "turn_off(objects): Turn off or extinguish a light source. objects: [target_id].",
	scope: (ctx) =>
		ctx.in_scope_objects.some(
			(o) => o.state?.lit === true || ["lantern", "lamp", "candle", "torch"].some((k) => o.id.includes(k)),
		),
	execute: (params, { state, world, stop }) => {
		const target = getTarget(params as { objects?: string[] });
		if (!target) {
			stop();
			return "Turn off what?";
		}
		if (!isInScope(state, target)) {
			stop();
			return "You don't see that here.";
		}
		const obj = world.objects[target];
		const objState = state.objects[target];
		if (objState?.state.lit === false) {
			stop();
			return `The ${obj?.name ?? target} is already off.`;
		}
		setObjectState(state, target, "lit", false);
		return `The ${obj?.name ?? target} is now off.`;
	},
};
