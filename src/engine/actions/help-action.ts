import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";

export const helpAction: ActionDefinition = {
	name: "help",
	description: "help(): Show the list of available commands. No parameters.",
	helpText: "**help** -- Show this message",
	inputSchema: z.object({}),
	parsePatterns: [{ pattern: /^(help|\?)$/, extract: () => ({}) }],
	handler(_params, _state, reg) {
		const lines = reg.getHelpLines();
		return {
			message: `**Available commands:**\n${lines.join("\n")}`,
			success: true,
		};
	},
};
