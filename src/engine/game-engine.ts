import * as fs from "node:fs";
import type { RecognizedIntent } from "../agent/types";
import type { ParserContext, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { ensureVisited, immutable, isInScope } from "./mutators";
import { buildParserContext } from "./parser-context";
import { ActionRegistry, EventBus, executeAction, executeUntrustedAction, type GameSetup } from "./rules";
import { registerCoreActions } from "./rules/core-actions";
import type { Observer } from "./rules/types";
import { load, type SaveFile, save } from "./save";
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

function allTargetsInScope(state: GameState, params: Record<string, unknown>): boolean {
	for (const key of OBJECT_PARAM_KEYS) {
		const ids = Array.isArray(params[key]) ? (params[key] as string[]) : [];
		for (const id of ids) {
			if (typeof id !== "string" || !id) continue;
			if (!isInScope(state, id)) return false;
		}
	}
	return true;
}

export class GameEngine {
	private state: GameState;
	private bus: EventBus;
	private registry: ActionRegistry;
	private history: GameState[] = [];

	constructor(
		private world: World,
		setup?: GameSetup,
	) {
		this.bus = new EventBus();
		this.registry = new ActionRegistry();
		this.state = buildInitialState(world);
		registerCoreActions(this.bus, this.registry);
		setup?.(this.bus, this.registry);
	}

	addObserver(observer: Observer): void {
		this.bus.addObserver(observer);
	}

	start(): string {
		const startResult = executeAction(this.bus, this.world, this.state, "game:start", {});
		this.state = startResult.state;

		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = immutable(lookResult.state, (s) => {
			ensureVisited(s, this.world.start_room);
		});

		return [...startResult.feedback, ...lookResult.feedback].join("\n");
	}

	getParserContext(): ParserContext {
		return buildParserContext(this.world, this.state);
	}

	getDescriptions(): Record<string, string> {
		return this.registry.getDescriptions();
	}

	getIntentMeta() {
		return this.registry.getIntentMeta();
	}

	runAction(intent: RecognizedIntent): string {
		if (intent.action === "undo") {
			return this.undo();
		}

		if (intent.action === "save") {
			const slot = (intent.slot ?? "default").trim();
			const sanitizedSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
			const filename = `.save-${this.world.id}-${sanitizedSlot}.json`;
			try {
				fs.writeFileSync(filename, JSON.stringify(this.save(), null, 2), "utf-8");
				return `Game saved to slot "${sanitizedSlot}".`;
			} catch (e) {
				return `Failed to save game: ${e instanceof Error ? e.message : String(e)}`;
			}
		}

		if (intent.action === "restore") {
			const slot = (intent.slot ?? "default").trim();
			const sanitizedSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
			const filename = `.save-${this.world.id}-${sanitizedSlot}.json`;
			try {
				if (!fs.existsSync(filename)) {
					return `No save file found for slot "${sanitizedSlot}".`;
				}
				const content = fs.readFileSync(filename, "utf-8");
				const data = JSON.parse(content);
				return this.restore(data);
			} catch (e) {
				return `Failed to restore game: ${e instanceof Error ? e.message : String(e)}`;
			}
		}

		// Conversational response — no game action
		if (intent.action === "respond") {
			return intent.message ?? "";
		}

		const action = intent.action;
		if (!this.registry.has(action)) {
			return intent.message ?? "I don't understand that.";
		}

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
		const tickResult = executeAction(this.bus, this.world, this.state, "tick", {});
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
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = lookResult.state;
		return lookResult.feedback.join("\n");
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
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = lookResult.state;
		return `Game restored.\n${lookResult.feedback.join("\n")}`;
	}

	isGameOver(): boolean {
		return this.state.player.state.quit === true;
	}

	private pushHistory(stateToSave: GameState = this.state): void {
		this.history.push(structuredClone(stateToSave));
		if (this.history.length > MAX_UNDO_HISTORY) {
			this.history.shift();
		}
	}
}
