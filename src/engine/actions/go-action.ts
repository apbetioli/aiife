import z from "zod";
import { Direction, DirectionSchema, GameState } from "../../types";
import { ActionDefinition, ActionRegistry } from "../ActionRegistry";
import {
	getCurrentRoom,
	getRoomNPCs,
	getVisibleItems,
} from "../ActionValidator";

const DIRECTION_ALIASES: Record<string, Direction> = {
	n: "north",
	s: "south",
	e: "east",
	w: "west",
	u: "up",
	d: "down",
	nw: "northwest",
	ne: "northeast",
	sw: "southwest",
	se: "southeast",
	in: "in",
	out: "out",
};

export const goAction: ActionDefinition = {
	name: "go",
	description: `go(direction): Go in a direction. direction can be one of: ${Object.values(DIRECTION_ALIASES).join(",")}.`,
	helpText: `**go <direction>** -- Go in a direction`,
	inputSchema: z.object({
		direction: DirectionSchema.describe("The direction to go"),
	}),
	parsePatterns: [
		// bare direction: n / north / ...
		{
			pattern: /^(n|s|e|w|u|d|nw|ne|sw|se|in|out)$/,
			extract: (m: RegExpMatchArray) => ({
				direction: DIRECTION_ALIASES[m[1]],
			}),
		},
	],
	handler(
		params: Record<string, unknown>,
		state: GameState,
		reg: ActionRegistry,
	) {
		const direction = params.direction as Direction | undefined;
		if (!direction) {
			return {
				success: false,
				message: "Which direction do you want to go?",
			};
		}

		const room = getCurrentRoom(state);
		const exit = room.exits.find((e) => e.direction === direction);
		if (!exit) {
			return {
				success: false,
				message: `You can't go ${direction} from here.`,
			};
		}
		if (exit.locked) {
			return {
				success: false,
				message: exit.description ?? "That way is locked.",
			};
		}

		const previousRoomId = state.currentRoomId;

		// Fire exit pseudo-action for the room we're leaving
		const exitResult = reg.runInteractions(
			"exit",
			{ roomId: previousRoomId },
			state,
		);

		state.currentRoomId = exit.targetRoomId;

		const newRoom = getCurrentRoom(state);
		const items = getVisibleItems(state);
		const npcs = getRoomNPCs(state);

		let message = `\n**${newRoom.name}**\n${newRoom.description}`;
		if (items.length > 0) {
			message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
		}
		if (npcs.length > 0) {
			message += `\n\n${npcs
				.map((n) => `There is a ${n.name} here.`)
				.join(" ")}`;
		}

		// Append exit interaction message if any
		if (exitResult) {
			message = `${exitResult.message}\n\n${message}`;
			if (exitResult.gameOver) {
				return { ...exitResult, message };
			}
		}

		// Fire enter pseudo-action for the new room
		const enterResult = reg.runInteractions(
			"enter",
			{ roomId: exit.targetRoomId },
			state,
		);

		if (enterResult) {
			message += `\n\n${enterResult.message}`;
			if (enterResult.gameOver) {
				return {
					message,
					success: true,
					gameOver: true,
					isVictory: enterResult.isVictory,
				};
			}
		}

		return { message, success: true };
	},
};
