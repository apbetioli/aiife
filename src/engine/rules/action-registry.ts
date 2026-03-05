import { z } from "zod";
import { DirectionSchema } from "../../world/types";

// ─── Core Actions (schema + description) ─────────────────────────────────────

const objectsParams = z.object({ objects: z.array(z.string()) });

export const coreActions = {
	go: {
		schema: z.object({ direction: DirectionSchema }),
		description:
			"go(direction): Go in a direction. direction must be one of: north, south, east, west, northeast, northwest, southeast, southwest, up, down, in, out. Normalize shorthands to full names: n→north, s→south, e→east, w→west, ne→northeast, nw→northwest, se→southeast, sw→southwest, u→up, d→down (in, out have no common shorthand).",
	},
	take: {
		schema: objectsParams,
		description:
			'take(objects): Pick up objects from the current room. For "take all", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
	},
	drop: {
		schema: objectsParams,
		description:
			'drop(objects): Drop objects from inventory. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
	},
	open: {
		schema: objectsParams,
		description:
			"open(objects): Open a container or door. objects: [target_id]. Use only when the player explicitly asks to open (e.g. 'open the box').",
	},
	close: {
		schema: objectsParams,
		description:
			"close(objects): Close a container or door. objects: [target_id].",
	},
	unlock: {
		schema: objectsParams,
		description:
			"unlock(objects): Unlock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	},
	lock: {
		schema: objectsParams,
		description:
			"lock(objects): Lock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	},
	examine: {
		schema: z.object({
			objects: z.array(z.string()),
			preposition: z.string().optional(),
		}),
		description:
			"examine(objects, preposition?): Look closely at an item, actor, or feature. objects: [target_id]. Shorthand: x. Use for 'look at X', 'look under X', 'look behind X', 'look in X', look inside X — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'.",
	},
	use: {
		schema: objectsParams,
		description:
			"use(objects): Use an object, optionally on a target. objects: [item_id] or [item_id, target_id] (e.g. 'use key on door' → [key, door]).",
	},
	move: {
		schema: z.object({
			objects: z.array(z.string()),
			direction: z.string().optional(),
		}),
		description:
			"move(objects, direction?): Move an object. objects: [target_id]. direction is optional.",
	},
	attack: {
		schema: objectsParams,
		description:
			"attack(objects): Attack something. objects: [target_id] or [target_id, weapon_id].",
	},
	talk: {
		schema: objectsParams,
		description:
			"talk(objects): Talk to an actor in the current room. objects: [actor_id].",
	},
	enter: { schema: z.object({ room: z.string() }), description: "" },
	exit: { schema: z.object({ room: z.string() }), description: "" },
	look: {
		schema: z.object({}),
		description:
			"look(): Look around the current room. No parameters. Shorthand: l. Use for 'look' with no target; for 'look at <something>' use examine instead.",
	},
	inventory: {
		schema: z.object({}),
		description:
			"inventory(): Check what the player is carrying. No parameters. Shorthand: i. Use for queries like 'what am I carrying?'.",
	},
	help: {
		schema: z.object({}),
		description:
			"help(): Show the list of available commands. No parameters. Shorthand: h.",
	},
	quit: {
		schema: z.object({}),
		description: "quit(): End the game. Shorthand: q.",
	},
	respond: {
		schema: z.object({ message: z.string() }),
		description:
			"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
	},
	tick: { schema: z.object({}), description: "" },
	"game:start": { schema: z.object({}), description: "" },
	"game:end": { schema: z.object({ victory: z.boolean() }), description: "" },
} as const satisfies Record<string, { schema: z.ZodType; description: string }>;

// ─── Parser Schema (flat shape for LLM structured output) ───────────────────
// All param fields from player-facing coreActions, made nullable.
// If you add a param field to a core action, add it here too — the runtime
// check below will throw if they drift apart.

export const StructuredOutputSchema = z.object({
	action: z.string(),
	direction: z.string().nullable(),
	objects: z.array(z.string()).nullable(),
	preposition: z.string().nullable(),
	message: z.string().nullable(),
});

export type StructuredOutput = z.infer<typeof StructuredOutputSchema>;

// Runtime drift check: every param field in a player-facing action must exist
// in StructuredOutputSchema. Runs once at import time.
(function assertParserSchemaCoversActions() {
	const parserKeys = new Set(Object.keys(StructuredOutputSchema.shape));
	for (const [name, entry] of Object.entries(coreActions)) {
		if (!entry.description) continue;
		for (const key of Object.keys(
			(entry.schema as z.ZodObject<z.ZodRawShape>).shape,
		)) {
			if (!parserKeys.has(key)) {
				throw new Error(
					`StructuredOutputSchema is missing field "${key}" from action "${name}". Add it as a nullable field.`,
				);
			}
		}
	}
})();

// ─── Derived Types ───────────────────────────────────────────────────────────

export type CoreEventParamsMap = {
	[K in keyof typeof coreActions]: z.infer<(typeof coreActions)[K]["schema"]>;
};

export type CoreEventName = keyof CoreEventParamsMap;

// ─── ActionRegistry ──────────────────────────────────────────────────────────

function unknownActionError(actionName: string): z.ZodError {
	return new z.ZodError([
		{ code: "custom", message: `Unknown action: ${actionName}`, path: [] },
	]);
}

interface ActionEntry {
	schema: z.ZodType;
	description: string;
}

export class ActionRegistry {
	private actions = new Map<string, ActionEntry>();

	constructor() {
		for (const [name, entry] of Object.entries(coreActions)) {
			this.actions.set(name, {
				schema: entry.schema,
				description: entry.description,
			});
		}
	}

	register(
		name: string,
		entry: { schema: z.ZodType; description: string },
	): void {
		this.actions.set(name, entry);
	}

	has(name: string): boolean {
		return this.actions.has(name);
	}

	names(): string[] {
		return [...this.actions.keys()];
	}

	validate(name: string, params: unknown): z.infer<z.ZodType> {
		const entry = this.actions.get(name);
		if (!entry) throw new Error(`Unknown action: ${name}`);
		return entry.schema.parse(params);
	}

	safeParse(
		name: string,
		params: unknown,
	):
		| { success: true; data: Record<string, unknown> }
		| { success: false; error: z.ZodError } {
		const entry = this.actions.get(name);
		if (!entry) return { success: false, error: unknownActionError(name) };
		return entry.schema.safeParse(params);
	}

	getDescriptions(): Record<string, string> {
		return Object.fromEntries(
			[...this.actions]
				.filter(([, entry]) => entry.description)
				.map(([name, entry]) => [name, entry.description]),
		);
	}
}
