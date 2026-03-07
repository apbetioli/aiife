import type { z } from "zod";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const help: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "help(): Show the list of available commands. No parameters. Shorthand: h.",
	handler: () => {
		const lines = [
			"Available commands:",
			"  go <direction>     - Move in a direction (n, s, e, w, up, down, ...)",
			"  look (l)           - Look around the current room",
			"  examine <thing> (x)- Look closely at something",
			"  take <thing>       - Pick up an object",
			"  drop <thing>      - Drop an object from inventory",
			"  open <thing>       - Open a container or door",
			"  close <thing>     - Close a container or door",
			"  unlock <thing>    - Unlock something (with key if needed)",
			"  use <thing>       - Use an object, optionally on a target",
			"  talk <person>     - Talk to someone",
			"  inventory (i)     - Check what you're carrying",
			"  help (h)           - Show this list",
			"  quit (q)          - End the game",
		];
		return lines.join("\n");
	},
};
