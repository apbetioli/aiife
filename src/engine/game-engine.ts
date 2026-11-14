import type { RecognizedIntent } from "../agent/types";
import type { ParserContext, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { ensureVisited, immutable, isInScope } from "./mutators";
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
import { load, type SaveFile, sanitizeSlot, save } from "./save";
import { FileSaveStorage, MemorySaveStorage, type SaveStorageAdapter } from "./storage";
import type { GameState } from "./types";

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
	private storage: SaveStorageAdapter;
	private lastIntent: RecognizedIntent | null = null;

	constructor(
		private world: World,
		setupOrOptions?: GameSetup | GameEngineOptions,
		storage?: SaveStorageAdapter,
	) {
		const options: GameEngineOptions =
			typeof setupOrOptions === "function" ? { setup: setupOrOptions } : (setupOrOptions ?? {});

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
		});

		return [...startResult.feedback, lookFeedback].filter(Boolean).join("\n");
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

	runAction(intent: RecognizedIntent): string {
		// Conversational response — no game action
		if (intent.action === "respond") {
			return intent.message ?? "";
		}

		if (!this.registry.has(intent.action)) {
			return intent.message ?? "I don't understand that.";
		}

		if (intent.action === "again") {
			if (!this.lastIntent) {
				return "There is no previous command to repeat.";
			}
			return this.runAction(this.lastIntent);
		}

		if (intent.action === "undo") {
			return this.undo();
		}

		if (intent.action === "save") {
			const slot = sanitizeSlot(intent.slot ?? undefined);
			try {
				this.storage.save(this.world.id, slot, this.save());
				return `Game saved to slot "${slot}".`;
			} catch (e) {
				return `Failed to save game: ${e instanceof Error ? e.message : String(e)}`;
			}
		}

		if (intent.action === "restore") {
			const slot = sanitizeSlot(intent.slot ?? undefined);
			try {
				if (!this.storage.exists(this.world.id, slot)) {
					return `No save file found for slot "${slot}".`;
				}
				const data = this.storage.load(this.world.id, slot);
				if (!data) {
					return `No save file found for slot "${slot}".`;
				}
				return this.restore(data);
			} catch (e) {
				return `Failed to restore game: ${e instanceof Error ? e.message : String(e)}`;
			}
		}

		this.lastIntent = intent;
		const action = intent.action;
		const params = toEventParams(intent);
		if (!allTargetsInScope(this.state, params)) {
			return "You don't see that here.";
		}

		const prevState = this.state;
		const result = executeUntrustedAction(this.bus, this.registry, this.world, this.state, action, params);
		this.state = result.state;

		if (result.stopped) {
			return result.feedback.length > 0 ? result.feedback.join("\n") : (intent.message ?? DEFAULT_FEEDBACK);
		}

		this.pushHistory(prevState);
		const tickResult = this.fireIfRegistered("tick");
		this.state = tickResult.state;

		const allFeedback = [...result.feedback, ...tickResult.feedback];
		return allFeedback.length > 0 ? allFeedback.join("\n") : (intent.message ?? DEFAULT_FEEDBACK);
	}

	undo(): string {
		const prev = this.history.pop();
		if (!prev) {
			return "Nothing to undo.";
		}
		this.state = prev;
		return this.renderLook("Previous turn undone.");
	}

	save(): SaveFile {
		return save(this.state);
	}

	restore(file: unknown): string {
		const restored = load(file);
		if (restored.world_id !== this.world.id) {
			return `Save is for "${restored.world_id}", but current game is "${this.world.id}".`;
		}
		this.pushHistory(this.state);
		this.state = restored;
		const look = this.renderLook();
		return look ? `Game restored.\n${look}` : "Game restored.";
	}

	isGameOver(): boolean {
		return this.state.player.state.quit === true;
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
