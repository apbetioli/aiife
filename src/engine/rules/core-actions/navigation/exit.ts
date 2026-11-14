import type { z } from "zod";
import { getPlayerVehicle, setPlayerVehicle } from "../../../mutators";
import type { GameState } from "../../../types";
import { getObjectIds } from "../helpers";
import { exitSchema } from "../schemas";
import type { ActionDef } from "../types";

const description =
	"exit(objects): Exit, disembark, or leave a vehicle (e.g. 'exit boat', 'disembark', 'leave', 'get out').";

export const exit: ActionDef<z.infer<typeof exitSchema>> = {
	inputSchema: exitSchema,
	description,
	aliases: ["disembark", "leave", "get out", "climb out"],
	hint: "Use exit, disembark, or leave to get out of a vehicle.",
	scope: (_ctx, state) => Boolean(!state || getPlayerVehicle(state as GameState) !== null),
	execute: (params, { state, world, stop }) => {
		// Internal room navigation event ({ room: "..." }) triggered by go action
		if (params.room && (!params.objects || params.objects.length === 0)) {
			return undefined;
		}

		if (state.player.state.dead) {
			stop();
			return "You are dead and cannot do that.";
		}

		const currentVehicle = getPlayerVehicle(state);
		if (!currentVehicle) {
			stop();
			return "You aren't in a vehicle.";
		}

		const ids = getObjectIds(params as { objects?: string[] });
		if (ids.length > 0) {
			const target = ids[0].toLowerCase();
			const curObj = world.objects[currentVehicle];
			const curName = curObj?.name.toLowerCase() ?? currentVehicle.toLowerCase();
			const curAliases = curObj?.aliases?.map((a) => a.toLowerCase()) ?? [];

			if (target !== currentVehicle.toLowerCase() && target !== curName && !curAliases.includes(target)) {
				stop();
				return `You aren't in the ${ids[0]}.`;
			}
		}

		setPlayerVehicle(state, null);
		const curObj = world.objects[currentVehicle];
		const vehName = curObj?.name ?? currentVehicle;
		const feedback = curObj?.descriptions?.exit ? curObj.descriptions.exit : `You get out of the ${vehName}.`;
		return feedback;
	},
};
