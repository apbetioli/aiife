import type { z } from "zod";
import { ensureVisited, movePlayer } from "../../mutators";
import { evaluateCondition } from "../../parser-context";
import { directionSchema } from "./schemas";
import type { ActionDef } from "./types";
import { runAction } from "./types";

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
			event.stop("You can't go that way.");
			return state;
		}
		if (exit.condition && !evaluateCondition(exit.condition, state)) {
			event.stop(exit.locked_message ?? "The way is blocked.");
			return state;
		}
		const from = state.player.current_room;
		const to = exit.leads_to;
		let nextState = movePlayer(state, to);
		nextState = ensureVisited(nextState, to);
		const exitResult = runAction(bus, world, nextState, "exit", { room: from });
		nextState = exitResult.state;
		const enterResult = runAction(bus, world, nextState, "enter", { room: to });
		nextState = enterResult.state;
		const lookResult = runAction(bus, world, nextState, "look", {});
		nextState = lookResult.state;
		const feedback = [...exitResult.feedback, ...enterResult.feedback, ...lookResult.feedback];
		return { state: nextState, feedback };
	},
};
