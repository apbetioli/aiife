import { z } from "zod";
import { type GameState, GameStateSchema } from "./types";

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

const SaveFileSchema = z.object({
	schema_version: z.number(),
	saved_at: z.string().datetime(),
	world_id: z.string(),
	state: GameStateSchema,
});

export type SaveFile = z.infer<typeof SaveFileSchema>;

// ─── Save ────────────────────────────────────────────────────────────────────

export function save(state: GameState): SaveFile {
	return {
		schema_version: SCHEMA_VERSION,
		saved_at: new Date().toISOString(),
		world_id: state.world_id,
		state,
	};
}

// ─── Load ────────────────────────────────────────────────────────────────────

export function load(file: unknown): GameState {
	const result = SaveFileSchema.safeParse(file);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  [${i.path.join(".")}] ${i.message}`)
			.join("\n");
		throw new Error(`Invalid save file:\n${issues}`);
	}

	if (result.data.schema_version !== SCHEMA_VERSION) {
		throw new Error(
			`Unsupported save file version: ${result.data.schema_version} (expected ${SCHEMA_VERSION})`,
		);
	}

	return result.data.state;
}
