import { z } from "zod";
import { DirectionSchema } from "../../../world/types";

export const directionSchema = z.object({ direction: DirectionSchema });

export const objectsSchema = z.object({ objects: z.array(z.string()) });

export const objectsWithPrepositionSchema = z.object({
	objects: z.array(z.string()),
	preposition: z.string().optional(),
});

export const objectsWithDirectionSchema = z.object({
	objects: z.array(z.string()),
	direction: z.string().optional(),
});

export const roomSchema = z.object({ room: z.string() });

export const messageSchema = z.object({ message: z.string() });

export const emptySchema = z.object({});

export const victorySchema = z.object({ victory: z.boolean() });
