import { coreActionDefinitions, type IntentMeta } from "../../engine/rules/core-actions";
import type { ParserContext, ScopedObject } from "../../world/types";

const DEFAULT_META: Record<string, IntentMeta> = Object.fromEntries(
	Object.entries(coreActionDefinitions)
		.filter(([, a]) => a.description)
		.map(([name, a]) => [name, { description: a.description, aliases: a.aliases, hint: a.hint }]),
);

function formatScopedObject(o: ScopedObject): string {
	const stateParts = Object.entries(o.state ?? {})
		.map(([k, v]) => {
			if (v === true) return k;
			if (v === false) return null;
			return `${k}: ${v}`;
		})
		.filter((x): x is string => x != null);
	const tag = [o.type, ...stateParts].join(", ");
	const aliases = o.aliases?.length ? ` aka ${o.aliases.join("/")}` : "";
	return `${o.name}${aliases} (${tag}) [${o.id}]`;
}

function formatObjectsInScope(objects: ScopedObject[], source: "room" | "inventory"): string {
	const filtered = objects.filter((o) => o.source === source);
	return filtered.length > 0 ? filtered.map(formatScopedObject).join(", ") : "none";
}

function buildGameStatePrompt(context: ParserContext): string {
	const exits = context.available_exits.length > 0 ? context.available_exits.join(", ") : "none";

	return `Current state:
  - Room: ${context.room} — ${context.description}
  - Exits: ${exits}
  - Objects in room: ${formatObjectsInScope(context.in_scope_objects, "room")}
  - Carrying: ${formatObjectsInScope(context.in_scope_objects, "inventory")}`;
}

function buildAliasTable(actions: string[], meta: Record<string, IntentMeta>): string {
	const lines = actions
		.filter((name) => meta[name]?.aliases?.length || meta[name]?.hint)
		.map((name) => {
			const { aliases, hint } = meta[name];
			const parts: string[] = [];
			if (aliases?.length) parts.push(aliases.join(", "));
			if (hint) parts.push(hint);
			return `  ${name}: ${parts.join(". ")}`;
		});

	if (lines.length === 0) return "";
	return `Input aliases (if the player's verb matches an alias, use that action):\n${lines.join("\n")}`;
}

function buildAvailableActionsPrompt(actions: string[], meta: Record<string, IntentMeta>): string {
	const lines = actions
		.filter((name) => meta[name]?.description)
		.map((name) => `- ${meta[name].description}`);

	return `Available actions:\n${lines.join("\n")}`;
}

const SYSTEM_PROMPT = `You are an intent parser for a text adventure game. Given the conversation history and the player's latest input, determine which single game action the player intends.

Rules:
- Choose exactly ONE action from the available actions list.
- Return the action name and its parameters as structured JSON.
- For entity references (direction, target, objects, actor): use only the entity's exact id inside the brackets in the game state (e.g. wooden_chest), with no extra characters or prefixes. DO NOT invent an id that is not in the game state.
- If the player's phrase only includes an action and there is a single matching entity in the game state, use it as the respective parameter.
- If the player's phrase is a substring of exactly one entity's name or id (e.g. "mail" → "small mailbox", "box" → "small mailbox"), use that object. Only match against the text of names and ids, not object types. Only do this when exactly one entity in scope matches.
- If the player's phrase says <action> ALL, include all matching entities as parameters.
- If the player's phrase matches more than one entity in scope, except when it says ALL, you must use respond to ask a clarification question. Do not guess or pick one. This applies regardless of the action — e.g. "take sword" with two swords in scope must produce respond, not take.
- When using respond, never expose internal IDs (like wooden_chest) in the message — use the entity's display name instead.
- If the last assistant message was a clarification (e.g. "What do you want to take?"), treat the player's reply as the answer and return that action with the parameter filled.`;

export function buildIntentSystemPrompt(
	context: ParserContext,
	actions: string[],
	meta?: Record<string, IntentMeta>,
): string {
	const resolved = meta ?? DEFAULT_META;
	const aliasTable = buildAliasTable(actions, resolved);

	return [
		SYSTEM_PROMPT,
		"",
		...(aliasTable ? [aliasTable, ""] : []),
		buildGameStatePrompt(context),
		"",
		buildAvailableActionsPrompt(actions, resolved),
	].join("\n");
}
