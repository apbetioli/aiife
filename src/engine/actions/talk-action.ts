import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import { resolveNPC } from "../ActionValidator";

export const talkAction: ActionDefinition = {
	name: "talk",
	description:
		"talk(npc): Talk to an NPC in the current room. npc is the name of the person to talk to.",
	helpText: "**talk to <person>** -- Speak with someone",
	inputSchema: z.object({
		npc: z.string().describe("Name of the NPC to talk to"),
	}),
	parsePatterns: [
		{
			pattern: /^talk\s+(?:to\s+)?(.+)$/,
			extract: (m) => ({ npc: m[1].trim() }),
		},
		{
			pattern: /^speak\s+(?:to|with)\s+(.+)$/,
			extract: (m) => ({ npc: m[1].trim() }),
		},
	],
	handler(params, state) {
		const npcName = params.npc as string | undefined;
		if (!npcName) {
			return { success: false, message: "Who do you want to talk to?" };
		}

		const npc = resolveNPC(npcName, state);
		if (!npc) {
			return {
				success: false,
				message: `You don't see anyone called "${npcName}" here.`,
			};
		}

		const line = npc.dialogue[npc.dialogueIndex];
		if (npc.dialogueIndex < npc.dialogue.length - 1) {
			npc.dialogueIndex++;
		}
		return { message: line, success: true };
	},
};
