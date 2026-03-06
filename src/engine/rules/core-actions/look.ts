import type { z } from "zod";
import { evaluateCondition, resolveRoomDescription } from "../../parser-context";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const look: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description:
		"look(): Look around the current room. No parameters. Shorthand: l. Use for 'look' with no target; for 'look at <something>' use examine instead.",
	handler: (_event, state, world) => {
		const roomId = state.player.current_room;
		const room = world.rooms[roomId];
		const roomState = state.rooms[roomId];
		const description = resolveRoomDescription(room, roomState);
		const lines: string[] = [`**${room.name}**`, description];
		for (const id of roomState.contains) {
			const obj = world.objects[id];
			if (!obj) continue;
			const objState = state.objects[id];
			lines.push(`There is a ${obj.name} here.`);
			if (obj.type === "container" && objState?.state.open) {
				const contentNames = (objState.contains ?? []).map((cid) => world.objects[cid]?.name).filter(Boolean);
				if (contentNames.length > 0) {
					lines.push(`The ${obj.name} contains:`);
					for (const name of contentNames) {
						lines.push(`  ${name}`);
					}
				}
			}
		}
		const exits = Object.entries(room.exits)
			.filter(([, exit]) => !exit.condition || evaluateCondition(exit.condition, state))
			.map(([dir]) => dir);
		if (exits.length > 0) {
			lines.push(`Exits: ${exits.join(", ")}.`);
		}
		return { state, feedback: [lines.join("\n")] };
	},
};
