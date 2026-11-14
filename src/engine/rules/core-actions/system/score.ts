import type { z } from "zod";
import { getScore } from "../../../score";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const score: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["points", "sc"],
	description: "score(): Display current score, maximum possible points, and moves/turns taken.",
	execute: (_params, { state, world }) => {
		if (state.player.state.dead) {
			return "How can you think of your score in your condition?";
		}
		const { score: currentScore, maxScore } = getScore(world, state);
		const turns =
			typeof state.turn === "number" && state.turn > 0
				? state.turn
				: ((state.player.state.moves as number) ?? 0);
		const moveWord = turns === 1 ? "move" : "moves";
		return `Your score is ${currentScore} of a possible ${maxScore} points, in ${turns} ${moveWord}.`;
	},
};
