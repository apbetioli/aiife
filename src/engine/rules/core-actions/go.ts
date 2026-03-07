import type { z } from "zod";
import { ensureVisited, movePlayer } from "../../mutators";
import { evaluateCondition } from "../../parser-context";
import { runAction } from "./helpers";
import { directionSchema } from "./schemas";
import type { ActionDef } from "./types";

const description =
	"go(direction): Go in a direction. direction must be one of: north, south, east, west, northeast, northwest, southeast, southwest, up, down, in, out. Normalize shorthands to full names: n→north, s→south, e→east, w→west, ne→northeast, nw→northwest, se→southeast, sw→southwest, u→up, d→down (in, out have no common shorthand).";

export const go: ActionDef<z.infer<typeof directionSchema>> = {
	schema: directionSchema,
	description,
	handler: (event, state, world, bus) => {
		const room = world.rooms[state.player.current_room];
		const direction = event.params.direction;
		const exit = room?.exits
			? (room.exits as Record<string, { leads_to: string; condition?: string; locked_message?: string }>)[direction]
			: undefined;
		if (!exit) {
			event.stop();
			return "You can't go that way.";
		}
		if (exit.condition && !evaluateCondition(exit.condition, state)) {
			event.stop();
			return exit.locked_message ?? "The way is blocked.";
		}
		const from = state.player.current_room;
		const to = exit.leads_to;
		movePlayer(state, to);
		ensureVisited(state, to);
		const exitFeedback = runAction(bus, world, state, "exit", { room: from });
		const enterFeedback = runAction(bus, world, state, "enter", { room: to });
		const lookFeedback = runAction(bus, world, state, "look", {});
		return [...exitFeedback, ...enterFeedback, ...lookFeedback];
	},
};
