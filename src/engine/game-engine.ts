import type { RecognizedIntent } from "../agent/types";
import { resolveVerbFrameAssumptions } from "../agent/verb-frames";
import type { ParserContext, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { ensureVisited, getDescriptionMode, immutable, isInScope } from "./mutators";
import { buildParserContext } from "./parser-context";
import {
	type ActionPack,
	ActionRegistry,
	EventBus,
	executeAction,
	executeUntrustedAction,
	type GameSetup,
} from "./rules";
import { registerActionPacks, standardAdventureActions } from "./rules/core-actions";
import type { Observer } from "./rules/types";
import {
	loadSaveFile,
	type ReplayResult,
	recreateStateFromHistory,
	replayHistory,
	type SaveFile,
	sanitizeSlot,
	save,
	type TurnHistoryEntry,
} from "./save";
import { getScore, syncScore } from "./score";
import { FileSaveStorage, MemorySaveStorage, type SaveStorageAdapter } from "./storage";
import type { DescriptionMode, GameState } from "./types";

const DEFAULT_FEEDBACK = "Done.";
const INTENT_PARAM_KEYS_TO_SKIP = new Set(["action", "message"]);
const MAX_UNDO_HISTORY = 50;

function toEventParams(intent: RecognizedIntent): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(intent).filter(
			([key, value]) => !INTENT_PARAM_KEYS_TO_SKIP.has(key) && value !== null && value !== undefined,
		),
	);
}

/** Object IDs that must be in current room or inventory for the action to be valid. */
const OBJECT_PARAM_KEYS = ["objects"] as const;
const AMBIENT_TARGETS = new Set(["floor", "ground"]);

function allTargetsInScope(state: GameState, params: Record<string, unknown>): boolean {
	for (const key of OBJECT_PARAM_KEYS) {
		const ids = Array.isArray(params[key]) ? (params[key] as string[]) : [];
		for (const id of ids) {
			if (typeof id !== "string" || !id) continue;
			if (AMBIENT_TARGETS.has(id) || id === state.player.current_room) continue;
			if (!isInScope(state, id)) return false;
		}
	}
	return true;
}

export interface GameEngineOptions {
	setup?: GameSetup;
	storage?: SaveStorageAdapter;
	actions?: ActionPack | ActionPack[];
}

export class GameEngine {
	private state: GameState;
	private bus: EventBus;
	private registry: ActionRegistry;
	private history: GameState[] = [];
	private commandHistory: TurnHistoryEntry[] = [];
	private options: GameEngineOptions;
	private storage: SaveStorageAdapter;
	private lastIntent: RecognizedIntent | null = null;
	private lastActionStopped = false;

	constructor(
		private world: World,
		setupOrOptions?: GameSetup | GameEngineOptions,
		storage?: SaveStorageAdapter,
	) {
		const options: GameEngineOptions =
			typeof setupOrOptions === "function" ? { setup: setupOrOptions } : (setupOrOptions ?? {});
		this.options = options;

		this.storage = storage ?? options.storage ?? (process.env.VITEST ? new MemorySaveStorage() : new FileSaveStorage());

		this.bus = new EventBus();
		this.registry = new ActionRegistry();
		this.state = buildInitialState(world);
		const actions = options.actions !== undefined ? options.actions : standardAdventureActions;
		registerActionPacks(this.bus, this.registry, actions);
		options.setup?.(this.bus, this.registry);
	}

	addObserver(observer: Observer): void {
		this.bus.addObserver(observer);
	}

	start(): string {
		const startResult = this.fireIfRegistered("game:start");
		this.state = startResult.state;

		const lookFeedback = this.renderLook();
		this.state = immutable(this.state, (s) => {
			ensureVisited(s, this.world.start_room);
			syncScore(this.world, s);
		});

		return [...startResult.feedback, lookFeedback].filter(Boolean).join("\n");
	}

	getScore(): { score: number; maxScore: number } {
		return getScore(this.world, this.state);
	}

	getDescriptionMode(): DescriptionMode {
		return getDescriptionMode(this.state);
	}

	getParserContext(): ParserContext {
		return buildParserContext(this.world, this.state);
	}

	getDescriptions(): Record<string, string> {
		return this.registry.getDescriptions();
	}

	getActionRegistry(): ActionRegistry {
		return this.registry;
	}

	getActiveActions(): string[] {
		return this.registry.getActiveActions(this.getParserContext(), this.state);
	}

	areTargetsInScope(intent: RecognizedIntent): boolean {
		return allTargetsInScope(this.state, toEventParams(intent));
	}

	getState(): GameState {
		return this.state;
	}

	getCommandHistory(): TurnHistoryEntry[] {
		return structuredClone(this.commandHistory);
	}

	setCommandHistory(history: TurnHistoryEntry[]): void {
		this.commandHistory = structuredClone(history);
	}

	clearCommandHistory(): void {
		this.commandHistory = [];
	}

	recordCommand(entry: TurnHistoryEntry): void {
		this.commandHistory.push(structuredClone(entry));
	}

	updateLastCommand(patch: Partial<TurnHistoryEntry>): void {
		if (this.commandHistory.length === 0) return;
		const last = this.commandHistory[this.commandHistory.length - 1];
		Object.assign(last, patch);
	}

	recreateFromHistory(historyOrSave?: TurnHistoryEntry[] | SaveFile): GameState {
		return recreateStateFromHistory(this.world, historyOrSave ?? this.commandHistory, this.options);
	}

	replayHistory(historyOrSave?: TurnHistoryEntry[] | SaveFile): ReplayResult {
		return replayHistory(this.world, historyOrSave ?? this.commandHistory, this.options);
	}

	runAction(intent: RecognizedIntent, options?: { rawInput?: string; skipHistory?: boolean }): string {
		this.lastActionStopped = false;

		// Conversational response — no game action
		if (intent.action === "respond") {
			this.lastActionStopped = true;
			const feedback = intent.message ?? "";
			this.recordCommandIfNeeded(intent, feedback, options);
			return feedback;
		}

		// Resolve verb frame assumptions if parameters are missing
		const { intent: resolvedIntent, announcement } = resolveVerbFrameAssumptions(intent, this.world, this.state);
		intent = resolvedIntent;

		if (!this.registry.has(intent.action)) {
			this.lastActionStopped = true;
			const feedback = intent.message ?? "I don't understand that.";
			this.recordCommandIfNeeded(intent, feedback, options);
			return feedback;
		}

		if (intent.action === "again") {
			if (!this.lastIntent) {
				this.lastActionStopped = true;
				const feedback = "There is no previous command to repeat.";
				this.recordCommandIfNeeded(intent, feedback, options);
				return feedback;
			}
			return this.runAction(this.lastIntent, options);
		}

		if (intent.action === "undo") {
			const feedback = this.undo();
			this.recordCommandIfNeeded(intent, feedback, options);
			return feedback;
		}

		if (intent.action === "restart") {
			return this.restart();
		}

		if (intent.action === "save") {
			const slot = sanitizeSlot(intent.slot ?? undefined);
			try {
				this.storage.save(this.world.id, slot, this.save());
				const feedback = `Game saved to slot "${slot}".`;
				this.recordCommandIfNeeded(intent, feedback, options);
				return feedback;
			} catch (e) {
				this.lastActionStopped = true;
				const feedback = `Failed to save game: ${e instanceof Error ? e.message : String(e)}`;
				this.recordCommandIfNeeded(intent, feedback, options);
				return feedback;
			}
		}

		if (intent.action === "restore") {
			const slot = sanitizeSlot(intent.slot ?? undefined);
			try {
				if (!this.storage.exists(this.world.id, slot)) {
					this.lastActionStopped = true;
					const feedback = `No save file found for slot "${slot}".`;
					this.recordCommandIfNeeded(intent, feedback, options);
					return feedback;
				}
				const data = this.storage.load(this.world.id, slot);
				if (!data) {
					this.lastActionStopped = true;
					const feedback = `No save file found for slot "${slot}".`;
					this.recordCommandIfNeeded(intent, feedback, options);
					return feedback;
				}
				const feedback = this.restore(data);
				this.recordCommandIfNeeded(intent, feedback, options);
				return feedback;
			} catch (e) {
				this.lastActionStopped = true;
				const feedback = `Failed to restore game: ${e instanceof Error ? e.message : String(e)}`;
				this.recordCommandIfNeeded(intent, feedback, options);
				return feedback;
			}
		}

		this.lastIntent = intent;
		const action = intent.action;
		const params = toEventParams(intent);
		if (!allTargetsInScope(this.state, params)) {
			this.lastActionStopped = true;
			const feedback = "You don't see that here.";
			this.recordCommandIfNeeded(intent, feedback, options);
			return feedback;
		}

		const prevState = this.state;
		const result = executeUntrustedAction(this.bus, this.registry, this.world, this.state, action, params);
		this.state = result.state;

		if (result.stopped) {
			this.lastActionStopped = true;
			const feedback = result.feedback.length > 0 ? result.feedback.join("\n") : (intent.message ?? DEFAULT_FEEDBACK);
			const fullFeedback = announcement ? `${announcement}\n${feedback}` : feedback;
			this.recordCommandIfNeeded(intent, fullFeedback, options);
			return fullFeedback;
		}

		this.pushHistory(prevState);
		const tickResult = this.fireIfRegistered("tick");
		this.state = tickResult.state;

		const allFeedback = [...result.feedback, ...tickResult.feedback];
		const feedback = allFeedback.length > 0 ? allFeedback.join("\n") : (intent.message ?? DEFAULT_FEEDBACK);
		const fullFeedback = announcement ? `${announcement}\n${feedback}` : feedback;
		this.recordCommandIfNeeded(intent, fullFeedback, options);
		return fullFeedback;
	}

	private recordCommandIfNeeded(
		intent: RecognizedIntent,
		feedback: string,
		options?: { rawInput?: string; skipHistory?: boolean },
	): void {
		if (options?.skipHistory) return;

		const entry: TurnHistoryEntry = {
			turn: this.state.turn ?? 0,
			input: options?.rawInput ?? intent.action,
			output: feedback,
			intent: structuredClone(intent),
			state: structuredClone(this.state),
			timestamp: new Date().toISOString(),
		};
		this.commandHistory.push(entry);
	}

	undo(): string {
		const prev = this.history.pop();
		if (!prev) {
			this.lastActionStopped = true;
			return "Nothing to undo.";
		}
		this.state = prev;
		return this.renderLook("Previous turn undone.");
	}

	restart(): string {
		this.history = [];
		this.commandHistory = [];
		this.lastIntent = null;
		this.state = buildInitialState(this.world);
		const startFeedback = this.start();
		return startFeedback ? `Restarting game.\n${startFeedback}` : "Restarting game.";
	}

	save(): SaveFile {
		return save(this.state, this.commandHistory);
	}

	restore(file: unknown): string {
		const saveFile = loadSaveFile(file);
		if (saveFile.world_id !== this.world.id) {
			return `Save is for "${saveFile.world_id}", but current game is "${this.world.id}".`;
		}
		this.pushHistory(this.state);
		this.state = saveFile.state;
		this.commandHistory = saveFile.history ?? [];
		const look = this.renderLook();
		return look ? `Game restored.\n${look}` : "Game restored.";
	}

	isPlayerDead(): boolean {
		return Boolean(this.state.player.state.dead);
	}

	wasLastActionStopped(): boolean {
		return this.lastActionStopped || this.isPlayerDead();
	}

	isGameOver(): boolean {
		return this.state.player.state.quit === true || this.state.player.state.dead === true;
	}

	runActions(
		intents: RecognizedIntent[],
		options?: { rawInputs?: string[]; skipHistory?: boolean },
	): { feedback: string; outputs: string[]; halted: boolean } {
		const outputs: string[] = [];
		let halted = false;

		for (let i = 0; i < intents.length; i++) {
			const intent = intents[i];
			const rawInput = options?.rawInputs?.[i];
			const feedback = this.runAction(intent, { rawInput, skipHistory: options?.skipHistory });
			outputs.push(feedback);

			if (this.wasLastActionStopped() || this.isGameOver()) {
				halted = true;
				break;
			}
		}

		return {
			feedback: outputs.join("\n"),
			outputs,
			halted,
		};
	}

	private fireIfRegistered(
		action: string,
		params: Record<string, unknown> = {},
	): { state: GameState; feedback: string[] } {
		if (!this.registry.has(action)) {
			return { state: this.state, feedback: [] };
		}
		return executeAction(this.bus, this.world, this.state, action, params);
	}

	private renderLook(fallback = ""): string {
		if (!this.registry.has("look")) {
			return fallback;
		}
		const res = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = res.state;
		return res.feedback.join("\n");
	}

	private pushHistory(stateToSave: GameState = this.state): void {
		this.history.push(structuredClone(stateToSave));
		if (this.history.length > MAX_UNDO_HISTORY) {
			this.history.shift();
		}
	}
}
