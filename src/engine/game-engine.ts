import type { ActionResult, StructuredOutput } from "../agent/types";
import type { ParserContext, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import {
	type ActionRegistry,
	createRules,
	type EventBus,
	executeAction,
	executeUntrustedAction,
	type GameSetup,
} from "./rules";
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
		const { bus, registry } = createRules(world, setup);
		this.bus = bus;
		this.registry = registry;
		this.state = buildInitialState(world);
	}

	start(): ActionResult {
		const startResult = executeAction(this.bus, this.world, this.state, "game:start", {});
		this.state = startResult.state;

		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		this.state = lookResult.state;

		const message = [...startResult.feedback, ...lookResult.feedback].join("\n");
		return { message, success: true };
	}

	getParserContext(): ParserContext {
		return buildParserContext(this.world, this.state);
	}

	getDescriptions(): Record<string, string> {
		return this.registry.getDescriptions();
	}

	runAction(intent: StructuredOutput): ActionResult {
		// Conversational response — no game action
		if (intent.action === "respond") {
			return {
				message: intent.message ?? "",
				success: true,
			};
		}

		const action = intent.action;
		if (!this.registry.has(action)) {
			return {
				message: intent.message ?? "I don't understand that.",
				success: false,
			};
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
		const message = allFeedback.length > 0 ? allFeedback.join(" ") : (intent.message ?? "Done.");

		return {
			message,
			success: !result.cancelled,
			gameOver: false,
			isVictory: false,
		};
	}

	undo(): ActionResult {
		const prev = this.history.pop();
		if (!prev) {
			return { message: "Nothing to undo.", success: false };
		}
		this.state = prev;
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		return { message: lookResult.feedback.join("\n"), success: true };
	}

	save(): SaveFile {
		return save(this.state);
	}

	restore(file: unknown): ActionResult {
		const restored = load(file);
		if (restored.world_id !== this.world.id) {
			return {
				message: `Save is for "${restored.world_id}", but current game is "${this.world.id}".`,
				success: false,
			};
		}
		this.pushHistory();
		this.state = restored;
		const lookResult = executeAction(this.bus, this.world, this.state, "look", {});
		return {
			message: `Game restored.\n${lookResult.feedback.join("\n")}`,
			success: true,
		};
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
