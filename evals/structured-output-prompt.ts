import { coreActionDescriptions } from "../src/engine/rules/action-registry";
import type { ParserContext, ScopedObject } from "../src/world/types";

/** Description for respond — the only action not routed through the bus. */
export const respondDescription =
	"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').";

/** All action descriptions: core bus actions (with non-empty descriptions) + respond. */
export const ACTION_DESCRIPTIONS: Record<string, string> = {
	...coreActionDescriptions,
	respond: respondDescription,
};

// Remove internal events with empty descriptions
for (const [key, value] of Object.entries(ACTION_DESCRIPTIONS)) {
	if (!value) delete ACTION_DESCRIPTIONS[key];
}

export function buildAvailableActionsPrompt(
	actionNames: string[],
	descriptions: Record<string, string> = ACTION_DESCRIPTIONS,
): string {
	const lines = actionNames
		.filter((name) => name in descriptions)
		.map((name) => `- ${descriptions[name]}`);

	return `Available actions:\n${lines.join("\n")}`;
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
	descriptions?: Record<string, string>,
): string {
	return [
		STRUCTURED_OUTPUT_SYSTEM_PROMPT,
		"",
		buildGameStateSnapshotPrompt(context),
		"",
		buildAvailableActionsPrompt(actions, descriptions),
	].join("\n");
}
