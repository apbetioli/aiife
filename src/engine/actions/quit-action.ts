import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";

// TODO confirm with user. Show:
// Current score (of total) in X moves
// Rank
export const quitAction: ActionDefinition = {
	name: "quit",
	description: "quit(): End the game",
	helpText: "**quit** -- End the game",
	inputSchema: z.object({}),
	parsePatterns: [{ pattern: /^(quit|q|exit)$/, extract: () => ({}) }],
	handler(_params, state) {
		state.gameOver = true;
		return {
			message: "Thanks for playing! Goodbye.",
			success: true,
			gameOver: true,
		};
	},
};
