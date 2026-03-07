import type { StructuredOutput } from "../agent/types";
import type { ParserContext, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import { ActionRegistry, EventBus, executeAction, executeUntrustedAction, type GameSetup } from "./rules";
import { registerCoreActions } from "./rules/core-actions";
import { load, type SaveFile, save } from "./save";
import type { GameState } from "./types";

const INTENT_PARAM_KEYS_TO_SKIP = new Set(["action", "message"]);
const MAX_UNDO_HISTORY = 50;

function toEventParams(intent: StructuredOutput): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(intent).filter(
			([key, value]) => !INTENT_PARAM_KEYS_TO_SKIP.has(key) && value !== null && value !== undefined,
		),
	);
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

	start(): string {
		const startResult = executeAction(this.bus, this.world, this.state, "game:start", {});
		this.state = startResult.state;

		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = lookResult.state;

		return [...startResult.feedback, ...lookResult.feedback].join("\n");
	}

	getParserContext(): ParserContext {
		return buildParserContext(this.world, this.state);
	}

	getDescriptions(): Record<string, string> {
		return this.registry.getDescriptions();
	}

	runAction(intent: StructuredOutput): string {
		// Conversational response — no game action
		if (intent.action === "respond") {
			return intent.message ?? "";
		}

		const action = intent.action;
		if (!this.registry.has(action)) {
			return intent.message ?? "I don't understand that.";
		}

		// Save state before mutation for undo
		this.pushHistory();

		const params = toEventParams(intent);
		const result = executeUntrustedAction(this.bus, this.registry, this.world, this.state, action, params);
		this.state = result.state;

		// Fire tick after every action
		const tickResult = executeAction(this.bus, this.world, this.state, "tick", {});
		this.state = tickResult.state;

		const allFeedback = [...result.feedback, ...tickResult.feedback];
		return allFeedback.length > 0 ? allFeedback.join("\n") : (intent.message ?? "Done.");
	}

	undo(): string {
		const prev = this.history.pop();
		if (!prev) {
			return "Nothing to undo.";
		}
		this.state = prev;
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
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
		this.pushHistory();
		this.state = restored;
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		return `Game restored.\n${lookResult.feedback.join("\n")}`;
	}

	isGameOver(): boolean {
		return this.state.player.state.quit === true;
	}

	private pushHistory(): void {
		this.history.push(structuredClone(this.state));
		if (this.history.length > MAX_UNDO_HISTORY) {
			this.history.shift();
		}
	}
}
