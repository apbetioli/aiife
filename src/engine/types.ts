import { z } from "zod";
import { PlayerSchema } from "../world/types";

// ─── Game State Schema ────────────────────────────────────────────────────────

const RoomStateSchema = z.object({
	visited: z.boolean(),
	contains: z.array(z.string()),
});

const ObjectStateSchema = z
	.object({
		contains: z.array(z.string()).optional(),
	})
	.catchall(z.union([z.boolean(), z.string(), z.number()]));

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
