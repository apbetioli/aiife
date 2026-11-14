import type { z } from "zod";
import { setPlayerState } from "../../../mutators";
import { syncScore } from "../../../score";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const tick: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description: "",
	execute: (_params, { state, world }) => {
		const moves = ((state.player.state.moves as number) ?? 0) + 1;
		setPlayerState(state, "moves", moves);
		state.turn = (state.turn ?? 0) + 1;
		if (world) {
			syncScore(world, state);
		}
	},
};
