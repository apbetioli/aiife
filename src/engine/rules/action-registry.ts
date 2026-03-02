import { z } from "zod";
import { DirectionSchema } from "../../world/types";

// ─── Core Actions (schema + description) ─────────────────────────────────────

const targetParams = z.object({ target: z.string() });
const targetInstrumentParams = z.object({
	target: z.string(),
	instrument: z.string().optional(),
});

export const coreActions = {
	go: {
		schema: z.object({ direction: DirectionSchema }),
		description:
			"go(direction): Go in a direction. direction must be one of: north, south, east, west, northeast, northwest, southeast, southwest, up, down, in, out. Normalize shorthands to full names: n→north, s→south, e→east, w→west, ne→northeast, nw→northwest, se→southeast, sw→southwest, u→up, d→down (in, out have no common shorthand).",
	},
	take: {
		schema: z.object({ objects: z.array(z.string()) }),
		description:
			'take(objects): Pick up objects from the current room. objects is an array of object ids. For "take all" or "take everything", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
	},
	drop: {
		schema: z.object({ objects: z.array(z.string()) }),
		description:
			'drop(objects): Drop objects from inventory. objects is an array of object ids. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
	},
	open: {
		schema: targetParams,
		description:
			"open(target): Open a container or door. target is the id of what to open. Use only when the player explicitly asks to open (e.g. 'open the box'); for 'look inside' use examine.",
	},
	close: {
		schema: targetParams,
		description:
			"close(target): Close a container or door. target is the id of what to close.",
	},
	unlock: {
		schema: targetInstrumentParams,
		description:
			"unlock(target, instrument?): Unlock something. target is the id of what to unlock. instrument is the optional key id.",
	},
	lock: {
		schema: targetInstrumentParams,
		description:
			"lock(target, instrument?): Lock something. target is the id of what to lock. instrument is the optional key id.",
	},
	examine: {
		schema: targetParams,
		description:
			"examine(target, preposition?): Look closely at an item, actor, or feature. target is the id of what to examine (from the object list). Shorthand: x. Use for 'look at X', 'look inside X' (preposition: in/inside), 'look under X', 'look behind X', 'look in X' — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'. Use 'open' only when the player explicitly says open (e.g. 'open the box').",
	},
	use: {
		schema: z.object({
			target: z.string().optional(),
			indirect: z.string().optional(),
			objects: z.array(z.string()).optional(),
		}),
		description:
			"use(objects, target?): Use an object, optionally on a target. objects is an array with the object id. target is the optional id of what to use it on.",
	},
	move: {
		schema: z.object({ target: z.string(), direction: z.string().optional() }),
		description:
			"move(target, direction?): Move an object. target is the id of what to move. direction is optional.",
	},
	attack: {
		schema: targetInstrumentParams,
		description:
			"attack(target, instrument?): Attack something. target is the id of what to attack. instrument is the optional weapon id.",
	},
	talk: {
		schema: z.object({ target: z.string() }),
		description:
			"talk(actor): Talk to an actor in the current room. actor is the id of the person to talk to.",
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
	tick: { schema: z.object({}), description: "" },
	"game:start": { schema: z.object({}), description: "" },
	"game:end": { schema: z.object({ victory: z.boolean() }), description: "" },
} as const satisfies Record<string, { schema: z.ZodType; description: string }>;

// Derived for backward compatibility and typing
export const coreActionSchemas = Object.fromEntries(
	Object.entries(coreActions).map(([k, v]) => [k, v.schema]),
) as { [K in keyof typeof coreActions]: (typeof coreActions)[K]["schema"] };

export const coreActionDescriptions = Object.fromEntries(
	Object.entries(coreActions).map(([k, v]) => [k, v.description]),
) as Record<keyof typeof coreActions, string>;

// ─── Derived Types ───────────────────────────────────────────────────────────

export type CoreEventParamsMap = {
	[K in keyof typeof coreActions]: z.infer<(typeof coreActions)[K]["schema"]>;
};

export type CoreEventName = keyof CoreEventParamsMap;

// ─── ActionRegistry ──────────────────────────────────────────────────────────

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
		if (!entry) {
			return {
				success: false,
				error: new z.ZodError([
					{ code: "custom", message: `Unknown action: ${name}`, path: [] },
				]),
			};
		}
		return entry.schema.safeParse(params);
	}

	getDescriptions(): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [name, entry] of this.actions) {
			if (entry.description) result[name] = entry.description;
		}
		return result;
	}
}
