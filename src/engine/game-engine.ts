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
} from "./rules";
import type { GameState } from "./types";

const INTENT_PARAM_KEYS_TO_SKIP = new Set(["action", "message"]);

function toEventParams(intent: StructuredOutput): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(intent).filter(
			([key, value]) =>
				!INTENT_PARAM_KEYS_TO_SKIP.has(key) &&
				value !== null &&
				value !== undefined,
		),
	);
}

export class GameEngine {
	private state: GameState;
	private bus: EventBus;
	private registry: ActionRegistry;

	constructor(private world: World) {
		const { bus, registry } = createRules(world);
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

		const params = toEventParams(intent);
		const result = executeUntrustedAction(
			this.bus,
			this.registry,
			this.world,
			this.state,
			action,
			params,
		);
		this.state = result.state;

		// Fire tick after every action
		const tickResult = executeAction(
			this.bus,
			this.world,
			this.state,
			"tick",
			{},
		);
		this.state = tickResult.state;

		const message =
			result.feedback.length > 0
				? result.feedback.join(" ")
				: (intent.message ?? "Done.");

		return {
			message,
			success: !result.cancelled,
			gameOver: false,
			isVictory: false,
		};
	}

	isGameOver(): boolean {
		return this.state.player.state.quit === true;
	}
}
