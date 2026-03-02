import { GameAgent } from "../agent/game-agent";
import { createModel } from "../agent/model";
import type { ActionResult, StructuredOutput } from "../agent/types";
import { DEBUG } from "../debug";
import type { World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import {
	createRules,
	type EventBus,
	type EventParamsMap,
	executeAction,
	isEventName,
} from "./rules";
import type { GameState } from "./types";

function toEventParams(intent: StructuredOutput): Record<string, unknown> {
	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(intent)) {
		if (key === "action" || key === "message") continue;
		if (value !== null && value !== undefined) params[key] = value;
	}
	return params;
}

export class GameEngine {
	private state: GameState;
	private agent: GameAgent;
	private bus: EventBus;

	constructor(private world: World) {
		this.agent = new GameAgent(createModel());
		this.state = buildInitialState(world);
		this.bus = createRules(world);
	}

	async processInput(input: string): Promise<ActionResult> {
		const trimmed = input.trim();
		if (!trimmed) {
			const result = { message: "Say something!", success: false };
			return this.agent.narrateResult(result);
		}

		const context = buildParserContext(this.world, this.state);

		const intent = await this.agent.processIntent(trimmed, context);

		const result = this.runAction(intent);

		return this.agent.narrateResult(result);
	}

	private runAction(intent: StructuredOutput): ActionResult {
		DEBUG(`Action: ${intent.action} ${JSON.stringify(intent)}`);

		// Conversational response — no game action
		if (intent.action === "respond") {
			return {
				message: intent.message ?? "",
				success: true,
			};
		}

		const action = intent.action;
		if (!isEventName(action)) {
			return {
				message: intent.message ?? "I don't understand that.",
				success: false,
			};
		}

		const params = toEventParams(intent) as EventParamsMap[typeof action];
		const result = executeAction(
			this.bus,
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
		return false;
	}
}
