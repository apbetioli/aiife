import type { ParserContext, ScopedObject } from "../src/world/types";

export const ACTION_DESCRIPTIONS: Record<string, string> = {
	go: "go(direction): Go in a direction. direction must be one of: north, south, east, west, northeast, northwest, southeast, southwest, up, down, in, out. Normalize shorthands to full names: n→north, s→south, e→east, w→west, ne→northeast, nw→northwest, se→southeast, sw→southwest, u→up, d→down (in, out have no common shorthand).",
	look: "look(): Look around the current room. No parameters. Shorthand: l. Use for 'look' with no target; for 'look at <something>' use examine instead.",
	examine:
		"examine(target, preposition?): Look closely at an item, NPC, or feature. target is the id of what to examine (from the object list). Shorthand: x. Use for 'look at X', 'look inside X' (preposition: in/inside), 'look under X', 'look behind X', 'look in X' — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'. Use 'open' only when the player explicitly says open (e.g. 'open the box').",
	take: 'take(items): Pick up items from the current room. items is an array of item ids. For "take all" or "take everything", list every visible item id. For "take X and Y", list each item id in the array.',
	drop: 'drop(items): Drop items from inventory. items is an array of item ids. For "drop all", list every inventory item id. For "drop all but X", list every inventory item id except X.',
	use: "use(items, target?): Use an item, optionally on a target. items is an array with the item id. target is the optional id of what to use it on.",
	open: "open(target): Open a container or door. target is the id of what to open. Use only when the player explicitly asks to open (e.g. 'open the box'); for 'look inside' use examine.",
	talk: "talk(npc): Talk to an NPC in the current room. npc is the id of the person to talk to.",
	inventory:
		"inventory(): Check what the player is carrying. No parameters. Shorthand: i. Use for queries like 'what am I carrying?'.",
	help: "help(): Show the list of available commands. No parameters. Shorthand: h.",
	quit: "quit(): End the game. Shorthand: q.",
	respond:
		"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
};

export function buildAvailableActionsPrompt(actionNames: string[]): string {
	const descriptions = actionNames
		.filter((name) => name in ACTION_DESCRIPTIONS)
		.map((name) => `- ${ACTION_DESCRIPTIONS[name]}`);

	return `Available actions:\n${descriptions.join("\n")}`;
}

function formatScopedObject(o: ScopedObject): string {
	const stateParts = o.state
		? Object.entries(o.state)
				.map(([k, v]) => {
					if (v === true) return k;
					if (v === false) return null;
					return `${k}: ${v}`;
				})
				.filter((x): x is string => x != null)
		: [];
	const tag = [o.type, ...stateParts].join(", ");
	return `${o.name} (${tag}) [${o.id}]`;
}

export function buildGameStateSnapshotPrompt(context: ParserContext): string {
	const exits =
		context.available_exits.length > 0
			? context.available_exits.join(", ")
			: "none";
	const blockedExits =
		context.blocked_exits.length > 0
			? context.blocked_exits.map((e) => e.direction).join(", ")
			: "none";
	const roomObjects =
		context.in_scope_objects.length > 0
			? context.in_scope_objects
					.filter((o) => o.source === "room")
					.map((o) => formatScopedObject(o))
					.join(", ")
			: "none";
	const inventory =
		context.in_scope_objects.length > 0
			? context.in_scope_objects
					.filter((o) => o.source === "inventory")
					.map((o) => formatScopedObject(o))
					.join(", ")
			: "none";

	return `Current state:
  - Room: ${context.room} — ${context.description}
  - Exits: ${exits}
  - Blocked exits: ${blockedExits}
  - Objects in room: ${roomObjects}
  - Carrying: ${inventory}`;
}

const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `You are an intent parser for a text adventure game. Given the conversation history and the player's latest input, determine which single game action the player intends.

Rules:
- Choose exactly ONE action from the available actions list.
- Return the action name and its parameters as structured JSON.
- For object references (target, items, npc): use the object's id (in square brackets in the game state), not the display name.
- If the last assistant message was a clarification (e.g. "What do you want to take?"), treat the player's reply as the answer and return that action with the parameter filled.`;

export function buildStructuredOutputSystemPrompt(
	context: ParserContext,
	actions: string[],
): string {
	return [
		STRUCTURED_OUTPUT_SYSTEM_PROMPT,
		"",
		buildGameStateSnapshotPrompt(context),
		"",
		buildAvailableActionsPrompt(actions),
	].join("\n");
}
