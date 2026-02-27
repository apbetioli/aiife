import type { ParserContext } from "../src/world/types";

export const ACTION_DESCRIPTIONS: Record<string, string> = {
	go: "go(direction): Go in a direction. direction must be one of: north, south, east, west, up, down.",
	look: "look(): Look around the current room. No parameters.",
	examine:
		"examine(target): Look closely at an item, NPC, or feature. target is the name of what to examine.",
	take: 'take(items): Pick up items from the current room. items is an array of item names. For "take all", list every visible item.',
	drop: 'drop(items): Drop items from inventory. items is an array of item names. For "drop all", list every inventory item.',
	use: "use(items, target?): Use an item, optionally on a target. items is an array with the item name. target is the optional name of what to use it on.",
	open: "open(target): Open a container or door. target is the name of what to open.",
	talk: "talk(npc): Talk to an NPC in the current room. npc is the name of the person to talk to.",
	inventory: "inventory(): Check what the player is carrying. No parameters.",
	help: "help(): Show the list of available commands. No parameters.",
	quit: "quit(): End the game",
	respond:
		"respond(message): Reply to the player without changing game state. Use when input is ambiguous, incomplete, or conversational. message is the text to show.",
};

export function buildAvailableActionsPrompt(actionNames: string[]): string {
	const descriptions = actionNames
		.filter((name) => name in ACTION_DESCRIPTIONS)
		.map((name) => `- ${ACTION_DESCRIPTIONS[name]}`);

	return `Available actions:\n${descriptions.join("\n")}`;
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
	const objects =
		context.in_scope_objects.length > 0
			? context.in_scope_objects.map((o) => o.name).join(", ")
			: "none";

	return `Current state:
  - Room: ${context.room} — ${context.description}
  - Exits: ${exits}
  - Blocked exits: ${blockedExits}
  - In-scope objects: ${objects}`;
}

const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `You are an intent parser for a text adventure game. Given the player's input and the current game state, determine which single game action the player intends to perform.

Rules:
- Choose exactly ONE action from the available actions list.
- Return the action name and its parameters as structured JSON.
- Normalize direction abbreviations: n=north, s=south, e=east, w=west, u=up, d=down.
- Match parameter values to names visible in the game state (items, NPCs, exits).
- If the player input is ambiguous, incomplete, or conversational (not a clear game command), use the "respond" action with an appropriate clarifying message.
- For "look" with no target, use the "look" action. For "look at <something>", use the "examine" action. For "look inside <something>", use the "open" action.
- For inventory queries like "what am I carrying?", use the "inventory" action.
- For "take all" or "take everything", list ALL visible items in the items array.
- For "drop all but X", list ALL inventory items EXCEPT X in the items array.
- For "take X and Y", list each item name in the items array.`;

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
