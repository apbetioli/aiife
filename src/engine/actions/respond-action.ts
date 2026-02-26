import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";

export const respondAction: ActionDefinition = {
	name: "respond",
	description:
		"respond(message): Reply to the player without changing game state. Use when input is ambiguous, incomplete, or conversational. message is the text to show.",
	helpText: "",
	inputSchema: z.object({
		message: z.string().describe("The message to show the player"),
	}),
	parsePatterns: [],
	handler(params) {
		return { success: true, message: (params.message as string) ?? "" };
	},
};
