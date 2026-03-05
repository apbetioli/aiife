import { z } from "zod";
import { PlayerSchema, StateSchema } from "../world/types";

// ─── Game State Schema ────────────────────────────────────────────────────────

const RoomStateSchema = z.object({
	contains: z.array(z.string()),
	state: StateSchema.default({}),
});

const ObjectStateSchema = z.object({
	contains: z.array(z.string()).optional(),
	state: StateSchema.default({}),
});

export const GameStateSchema = z.object({
	world_id: z.string(),
	version: z.string(),
	turn: z.number(),
	player: PlayerSchema,
	rooms: z.record(z.string(), RoomStateSchema),
	objects: z.record(z.string(), ObjectStateSchema),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameState = z.infer<typeof GameStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type ObjectState = z.infer<typeof ObjectStateSchema>;
