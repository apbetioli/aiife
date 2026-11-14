import { z } from "zod";
import { splitCommands, tryDeterministicIntent } from "../agent/fast-path-parser";
import type { RecognizedIntent } from "../agent/types";
import type { World } from "../world/types";
import { GameEngine, type GameEngineOptions } from "./game-engine";
import { MemorySaveStorage } from "./storage";
import { type GameState, GameStateSchema } from "./types";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 2;
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2] as const;

export const TurnHistoryEntrySchema = z.object({
	turn: z.number(),
	input: z.string(),
	output: z.string(),
	intent: z.record(z.string(), z.unknown()).optional(),
	tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
	state: GameStateSchema.optional(),
	timestamp: z.string().optional(),
});

export type TurnHistoryEntry = z.infer<typeof TurnHistoryEntrySchema>;

export const SaveFileSchema = z.object({
	schema_version: z.number(),
	saved_at: z.string().datetime(),
	world_id: z.string(),
	state: GameStateSchema,
	history: z.array(TurnHistoryEntrySchema).optional(),
});

export type SaveFile = z.infer<typeof SaveFileSchema>;

export function sanitizeSlot(slot?: string): string {
	return (slot ?? "default").trim().replace(/[^a-zA-Z0-9_-]/g, "") || "default";
}

// ─── Save ────────────────────────────────────────────────────────────────────

export function save(state: GameState, history?: TurnHistoryEntry[], options?: { version?: number }): SaveFile {
	const version = options?.version ?? SCHEMA_VERSION;
	const file: SaveFile = {
		schema_version: version,
		saved_at: new Date().toISOString(),
		world_id: state.world_id,
		state,
	};
	if (history !== undefined || version >= 2) {
		file.history = history ? structuredClone(history) : [];
	}
	return file;
}

// ─── Load ────────────────────────────────────────────────────────────────────

export function loadSaveFile(file: unknown): SaveFile {
	const result = SaveFileSchema.safeParse(file);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `  [${i.path.join(".")}] ${i.message}`).join("\n");
		throw new Error(`Invalid save file:\n${issues}`);
	}

	if (!SUPPORTED_SCHEMA_VERSIONS.includes(result.data.schema_version as 1 | 2)) {
		throw new Error(`Unsupported save file version: ${result.data.schema_version} (expected ${SCHEMA_VERSION})`);
	}

	return {
		...result.data,
		history: result.data.history ?? [],
	};
}

export function load(file: unknown): GameState {
	return loadSaveFile(file).state;
}

// ─── Replay & State Reconstruction ───────────────────────────────────────────

export interface ReplayOptions extends GameEngineOptions {
	initialState?: GameState;
	verifySnapshots?: boolean;
}

export interface StateMismatch {
	turn: number;
	input?: string;
	expectedState: GameState;
	actualState: GameState;
	differences: string[];
}

export interface ReplayResult {
	finalState: GameState;
	matchesSavedState: boolean;
	outputs: string[];
	turnsExecuted: number;
	mismatches: StateMismatch[];
}

export function findStateDifferences(expected: GameState, actual: GameState): string[] {
	const diffs: string[] = [];
	if (expected.turn !== actual.turn) {
		diffs.push(`turn: expected ${expected.turn}, got ${actual.turn}`);
	}
	if (expected.player.current_room !== actual.player.current_room) {
		diffs.push(`player.current_room: expected "${expected.player.current_room}", got "${actual.player.current_room}"`);
	}
	for (const objId of Object.keys(expected.objects)) {
		const expLoc = expected.objects[objId]?.location;
		const actLoc = actual.objects[objId]?.location;
		if (expLoc !== actLoc) {
			diffs.push(`object "${objId}".location: expected "${expLoc}", got "${actLoc}"`);
		}
	}
	for (const roomId of Object.keys(expected.rooms)) {
		const expVisited = expected.rooms[roomId]?.state.visited;
		const actVisited = actual.rooms[roomId]?.state.visited;
		if (expVisited !== actVisited) {
			diffs.push(`room "${roomId}".visited: expected ${expVisited}, got ${actVisited}`);
		}
	}
	return diffs;
}

export function replayHistory(
	world: World,
	historyOrSave: TurnHistoryEntry[] | SaveFile,
	options?: ReplayOptions,
): ReplayResult {
	const history = Array.isArray(historyOrSave) ? historyOrSave : (historyOrSave.history ?? []);
	const expectedFinalState = Array.isArray(historyOrSave) ? history[history.length - 1]?.state : historyOrSave.state;

	const engine = new GameEngine(world, {
		setup: options?.setup,
		actions: options?.actions,
		storage: options?.storage ?? new MemorySaveStorage(),
	});

	engine.start();

	const outputs: string[] = [];
	const mismatches: StateMismatch[] = [];

	for (const entry of history) {
		const intentsToRun: RecognizedIntent[] = [];

		if (entry.intent && typeof entry.intent.action === "string") {
			intentsToRun.push(entry.intent as RecognizedIntent);
		} else if (entry.tool_calls && entry.tool_calls.length > 0) {
			for (const tc of entry.tool_calls) {
				const action = (tc.toolName ?? tc.name ?? tc.action) as string;
				const params = (tc.args ?? tc.input ?? tc.params ?? {}) as Record<string, unknown>;
				if (action) {
					intentsToRun.push({ action, ...params });
				}
			}
		} else if (entry.input) {
			const commands = splitCommands(entry.input);
			for (const cmd of commands) {
				const fast = tryDeterministicIntent(cmd);
				intentsToRun.push(fast ?? { action: cmd.trim() });
			}
		}

		for (const intent of intentsToRun) {
			if (intent.action === "save") {
				outputs.push("Game saved.");
			} else {
				const output = engine.runAction(intent, { skipHistory: true });
				outputs.push(output);
			}
		}

		if (options?.verifySnapshots !== false && entry.state) {
			const currentState = engine.getState();
			const diffs = findStateDifferences(entry.state, currentState);
			if (diffs.length > 0) {
				mismatches.push({
					turn: entry.turn,
					input: entry.input,
					expectedState: entry.state,
					actualState: currentState,
					differences: diffs,
				});
			}
		}
	}

	const finalState = engine.getState();
	let matchesSavedState = mismatches.length === 0;
	if (expectedFinalState) {
		const finalDiffs = findStateDifferences(expectedFinalState, finalState);
		if (finalDiffs.length > 0) {
			matchesSavedState = false;
		}
	}

	return {
		finalState,
		matchesSavedState,
		outputs,
		turnsExecuted: history.length,
		mismatches,
	};
}

export function recreateStateFromHistory(
	world: World,
	historyOrSave: TurnHistoryEntry[] | SaveFile,
	options?: ReplayOptions,
): GameState {
	return replayHistory(world, historyOrSave, options).finalState;
}
