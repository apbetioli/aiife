import { tool } from "ai";
import { type ActionEntry, type ActionRegistry, evaluateActionScope } from "../engine/rules/action-registry";
import { coreActionDefinitions } from "../engine/rules/core-actions";
import type { ActionDef } from "../engine/rules/types";
import type { ParserContext, ScopedObject } from "../world/types";

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

export function buildToolSystemPrompt(context: ParserContext): string {
	const exits = context.available_exits.length > 0 ? context.available_exits.join(", ") : "none";

	return `You are an intent parser for a text adventure game. Given the conversation history and player's input, call the single appropriate action tool.

Rules:
- Call exactly ONE tool that best represents the player's intended action.
- For entity references (direction, objects, target): use only the entity's exact ID inside the brackets in the game state (e.g. wooden_chest), with no extra characters. DO NOT invent an ID not in the game state.
- If the player's phrase only includes an action and there is a single matching entity in the game state, use it.
- If the player's phrase is a substring of an entity's name, ID, or alias (e.g. "mail" or "box" → "small mailbox"), use that entity. Only do this when exactly one entity in scope matches.
- If no exact or substring match, consider common synonyms and semantic equivalents (e.g. "lamp" for a lantern, "box" for a chest or mailbox). If exactly one entity is a plausible match, use it. If multiple could match, call respond.
- If the player's phrase refers to a plural noun (e.g. "swords", "keys"), lists multiple items (e.g. "sword and lantern"), or says ALL, include all matching entity IDs in the objects array.
- If the player's phrase is a singular reference that is ambiguous or matches multiple entities, call respond to ask for clarification.
- If the input is conversational, questions, unfulfillable, or not a recognized command, call respond.
- When calling respond, never expose internal IDs in the message — use display names instead.
- If the last assistant message was a clarification (e.g. "What do you want to take?"), treat the player's reply as the answer and return that action with the parameter filled.

Current state:
  - Room: ${context.room} — ${context.description}
  - Exits: ${exits}
  - Objects in room: ${formatObjectsInScope(context.in_scope_objects, "room")}
  - Carrying: ${formatObjectsInScope(context.in_scope_objects, "inventory")}`;
}

export interface BuildScopedToolsOptions {
	availableActions?: string[];
	definitions?: Record<string, ActionDef<unknown> | ActionEntry>;
	registry?: ActionRegistry;
	scopeTools?: boolean;
}

export function buildScopedTools(context: ParserContext, options: BuildScopedToolsOptions = {}) {
	const registryDefinitions = options.registry?.getDefinitions();
	const definitions =
		options.definitions ??
		registryDefinitions ??
		(coreActionDefinitions as unknown as Record<string, ActionDef<unknown> | ActionEntry>);
	const actionNames = options.availableActions ?? Object.keys(definitions);
	const shouldScope = options.scopeTools ?? true;

	// biome-ignore lint/suspicious/noExplicitAny: tools can take any input schema and return any output
	const tools: Record<string, ReturnType<typeof tool<any, any>>> = {};

	for (const name of actionNames) {
		const def = definitions[name];
		if (!def || !def.description) continue;

		// If scoping is enabled, check whether this action is in scope for the context
		if (shouldScope && def.scope && !evaluateActionScope(def.scope, context)) {
			continue;
		}

		const schema = def.inputSchema;
		if (!schema) continue;

		const aliasText = def.aliases?.length ? ` (Synonyms: ${def.aliases.join(", ")})` : "";
		const hintText = def.hint ? ` Note: ${def.hint}` : "";
		const fullDescription = `${def.description}${aliasText}${hintText}`;

		tools[name] = tool({
			description: fullDescription,
			inputSchema: schema,
		});
	}

	// Always ensure `respond` fallback is available if present in definitions
	if (!tools.respond && definitions.respond) {
		const respondDef = definitions.respond;
		const schema = respondDef.inputSchema;
		if (schema) {
			tools.respond = tool({
				description: respondDef.description,
				inputSchema: schema,
			});
		}
	}

	return tools;
}
