import { GameAgent } from "../agent/game-agent";
import { createModel } from "../agent/model";
import type { ActionResult, StructuredOutput } from "../agent/types";
import { DEBUG } from "../debug";
import type { Direction, World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import {
	createRules,
	type EventBus,
	type EventName,
	type EventParamsMap,
	executeAction,
} from "./rules";
import type { GameState } from "./types";

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

		const mapped = this.mapIntent(intent);
		if (!mapped) {
			return {
				message: intent.message ?? "I don't understand that.",
				success: false,
			};
		}

		const { action, params } = mapped;
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
			{} as EventParamsMap["tick"],
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

	private mapIntent(
		intent: StructuredOutput,
	): { action: EventName; params: EventParamsMap[EventName] } | null {
		switch (intent.action) {
			case "go": {
				const direction = intent.direction as Direction;
				const from = this.state.player.current_room;
				const room = this.world.rooms[from];
				const exit = room?.exits[direction];
				return {
					action: "go",
					params: {
						direction,
						from,
						to: exit?.leads_to ?? "",
					},
				};
			}
			case "take":
			case "drop":
			case "open":
			case "close":
			case "examine":
				return {
					action: intent.action,
					params: { target: intent.target ?? "" },
				};
			case "unlock":
			case "lock":
				return {
					action: intent.action,
					params: {
						target: intent.target ?? "",
						instrument: intent.items?.[0] ?? undefined,
					},
				};
			case "use":
				return {
					action: "use",
					params: {
						target: intent.target ?? "",
						indirect: intent.items?.[0] ?? undefined,
					},
				};
			case "attack":
				return {
					action: "attack",
					params: {
						target: intent.target ?? "",
						instrument: intent.items?.[0] ?? undefined,
					},
				};
			case "talk":
				return {
					action: "talk",
					params: { target: intent.npc ?? intent.target ?? "" },
				};
			default:
				return null;
		}
	}

	isGameOver(): boolean {
		return false;
	}
}
