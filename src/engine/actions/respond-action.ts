import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";

export const respondAction: ActionDefinition = {
	name: "respond",
	description:
		"Use this instead of a game-action tool when you need to reply without changing game state -- for example to ask a clarifying question, respond to conversational input, or tell the player you don't understand.",
	helpText: "",
	inputSchema: z.object({
		message: z.string().describe("The message to show the player"),
	}),
	parsePatterns: [],
	handler(params) {
		return { success: true, message: (params.message as string) ?? "" };
	},
};
