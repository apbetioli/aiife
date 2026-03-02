import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

/**
 * Uses a record of primitives rather than typed fields, because game state is
 * inherently open-ended — different objects and rooms need different state flags.
 * This keeps the schema flexible without requiring you to anticipate every flag upfront.
 */
const StateSchema = z.record(
	z.string(),
	z.union([z.boolean(), z.string(), z.number()]),
);

// ─── Object ───────────────────────────────────────────────────────────────────

const ObjectTypeSchema = z.enum([
	"item",
	"fixture",
	"container",
	"door",
	"actor",
	"weapon",
	"key",
]);

const RequiresInstrumentSchema = z.record(
	z.string(), // verb e.g. "unlock"
	z.string(), // object id e.g. "brass_key"
);

const GameObjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	synonyms: z.array(z.string()).default([]),
	type: ObjectTypeSchema,
	state: StateSchema.default({}),
	descriptions: z.record(z.string(), z.string()).refine((d) => "default" in d, {
		message: "descriptions must include a 'default' entry",
	}),
	requires_instrument: RequiresInstrumentSchema.optional(),
	contains: z.array(z.string()).optional(), // only for containers
});

// ─── Exit ─────────────────────────────────────────────────────────────────────

const DirectionSchema = z.enum([
	"north",
	"south",
	"east",
	"west",
	"northeast",
	"northwest",
	"southeast",
	"southwest",
	"up",
	"down",
	"in",
	"out",
]);

const ExitSchema = z.object({
	leads_to: z.string(), // room id
	condition: z.string().optional(), // expression string e.g. "oak_door.open == true"
	locked_message: z.string().optional(),
});

const ExitsSchema = z.record(DirectionSchema, ExitSchema);

// ─── Room ─────────────────────────────────────────────────────────────────────

const RoomSchema = z.object({
	id: z.string(),
	name: z.string(),
	descriptions: z.record(z.string(), z.string()).refine((d) => "default" in d, {
		message: "descriptions must include a 'default' entry",
	}),
	state: StateSchema.default({}),
	exits: ExitsSchema,
	contains: z.array(z.string()).default([]), // object ids
});

// ─── Player ───────────────────────────────────────────────────────────────────

const PlayerSchema = z.object({
	current_room: z.string(), // room id
	inventory: z.array(z.string()), // object ids
	state: StateSchema.default({}),
});

// ─── World ────────────────────────────────────────────────────────────────────

const WorldSchema = z.object({
	id: z.string(),
	name: z.string(),
	version: z.string().default("1.0.0"),
	start_room: z.string(),
	rooms: z.record(z.string(), RoomSchema),
	objects: z.record(z.string(), GameObjectSchema),
	player: PlayerSchema,
});

// ─── Parser Context Snapshot (runtime, derived from world) ────────────────────

const ScopedObjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: ObjectTypeSchema,
	state: StateSchema,
	/** "room" = in current room, "inventory" = in player's inventory */
	source: z.enum(["room", "inventory"]),
});

const BlockedExitSchema = z.object({
	direction: DirectionSchema,
	message: z.string(),
});

/**
 * It's a runtime derived view, not persisted world data.
 * The engine builds it on every turn from the world state before sending it to the LLM.
 */
const ParserContextSchema = z.object({
	room: z.string(),
	description: z.string(),
	available_exits: z.array(DirectionSchema),
	blocked_exits: z.array(BlockedExitSchema),
	in_scope_objects: z.array(ScopedObjectSchema),
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export type State = z.infer<typeof StateSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
export type GameObject = z.infer<typeof GameObjectSchema>;
export type Exit = z.infer<typeof ExitSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type World = z.infer<typeof WorldSchema>;
export type ParserContext = z.infer<typeof ParserContextSchema>;
export type BlockedExit = z.infer<typeof BlockedExitSchema>;
export type ScopedObject = z.infer<typeof ScopedObjectSchema>;
export type Direction = z.infer<typeof DirectionSchema>;

export {
	StateSchema,
	ObjectTypeSchema,
	GameObjectSchema,
	RoomSchema,
	PlayerSchema,
	WorldSchema,
	ParserContextSchema,
	DirectionSchema,
	ExitSchema,
};
