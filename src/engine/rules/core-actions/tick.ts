import type { z } from "zod";
import { setPlayerState } from "../../mutators";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const tick: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
	handler: (_event, state, _world) => {
		const moves = (state.player.state.moves as number) ?? 0;
		setPlayerState(state, "moves", moves + 1);
	},
};
