import { coreActionDefinitions } from "../../engine/rules/core-actions";
import type { ParserContext, ScopedObject } from "../../world/types";

const ACTION_DESCRIPTIONS_MAP = Object.fromEntries(
	Object.entries(coreActionDefinitions).map(([name, action]) => [name, action.description]),
);

function buildAvailableActionsPrompt(
	actionNames: string[],
	descriptions: Record<string, string> = ACTION_DESCRIPTIONS_MAP,
): string {
	const lines = actionNames
		.filter((name) => name in descriptions && descriptions[name] !== "")
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

function formatObjectsInScope(objects: ScopedObject[], source: "room" | "inventory"): string {
	const filtered = objects.filter((o) => o.source === source);
	return filtered.length > 0 ? filtered.map(formatScopedObject).join(", ") : "none";
}

function joinOrNone(items: string[]): string {
	return items.length > 0 ? items.join(", ") : "none";
}

function buildGameStateSnapshotPrompt(context: ParserContext): string {
	const exits = joinOrNone(context.available_exits);
	const roomObjects = formatObjectsInScope(context.in_scope_objects, "room");
	const inventory = formatObjectsInScope(context.in_scope_objects, "inventory");

	return `Current state:
  - Room: ${context.room} — ${context.description}
  - Exits: ${exits}
  - Objects in room: ${roomObjects}
  - Carrying: ${inventory}`;
}

const INTENT_RECOGNITION_SYSTEM_PROMPT = `You are an intent parser for a text adventure game. Given the conversation history and the player's latest input, determine which single game action the player intends.

Rules:
- Choose exactly ONE action from the available actions list.
- Return the action name and its parameters as structured JSON.
- For entity references (direction, target, objects, actor): use only the entity's exact id inside the brackets in the game state (e.g. wooden_chest), with no extra characters or prefixes. DO NOT invent an id that is not in the game state.
- If the player's phrase only includes an action and there is a single matching entity in the game state, use it as the respective parameter.
- If the player's phrase is a substring of exactly one entity's name or id (e.g. "mail" → "small mailbox", "box" → "small mailbox"), use that object. Only match against the text of names and ids, not object types. Only do this when exactly one entity in scope matches.
- If the player's phrase says <action> ALL, include all matching entities as parameters.
- If the player's phrase matches more than one entity in scope, except when it says ALL, you must use respond to ask a clarification question. Do not guess or pick one. This applies regardless of the action — e.g. "take sword" with two swords in scope must produce respond, not take.
- If the last assistant message was a clarification (e.g. "What do you want to take?"), treat the player's reply as the answer and return that action with the parameter filled.`;

export function buildIntentSystemPrompt(
	context: ParserContext,
	actions: string[],
	descriptions?: Record<string, string>,
): string {
	return [
		INTENT_RECOGNITION_SYSTEM_PROMPT,
		"",
		buildGameStateSnapshotPrompt(context),
		"",
		buildAvailableActionsPrompt(actions, descriptions),
	].join("\n");
}
