import { z } from "zod";
import { isTutorialMode, setTutorialMode } from "../../../mutators";
import type { ActionDef } from "../types";

const tutorialSchema = z.object({
	enabled: z.boolean().optional(),
});

export const tutorial: ActionDef<z.infer<typeof tutorialSchema>> = {
	inputSchema: tutorialSchema,
	aliases: ["easy", "tutorial-mode", "tutorial_mode"],
	description:
		"tutorial(enabled?): Toggle or set tutorial / easy mode (highlights interactable items, exits, and key verbs).",
	execute: (params, { state }) => {
		const current = isTutorialMode(state);
		const next = params.enabled !== undefined ? params.enabled : !current;
		setTutorialMode(state, next);
		if (next) {
			return "Tutorial mode is now ON. Interactable objects, exits, and commands will be highlighted.";
		}
		return "Tutorial mode is now OFF.";
	},
};
