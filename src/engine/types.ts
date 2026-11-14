import { z } from "zod";
import { StateSchema } from "../world/types";

// ─── Description Mode Schema ──────────────────────────────────────────────────

export const DescriptionModeSchema = z.enum(["brief", "superbrief", "verbose"]);
export type DescriptionMode = z.infer<typeof DescriptionModeSchema>;

// ─── Game State Schema ────────────────────────────────────────────────────────

const RoomStateSchema = z.object({
	state: StateSchema.default({}),
});

const ObjectStateSchema = z.object({
	location: z.string().nullable(),
	state: StateSchema.default({}),
});

const PlayerStateSchema = z.object({
	current_room: z.string(),
	capacity: z.number().optional().default(7),
	state: StateSchema.default({}),
});

export const GameStateSchema = z.object({
	world_id: z.string(),
	version: z.string(),
	turn: z.number(),
	player: PlayerStateSchema,
	rooms: z.record(z.string(), RoomStateSchema),
	objects: z.record(z.string(), ObjectStateSchema),
	description_mode: DescriptionModeSchema.optional().default("brief"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameState = z.infer<typeof GameStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type ObjectState = z.infer<typeof ObjectStateSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
