import { GameAgent } from "../agent/game-agent";
import { createModel } from "../agent/model";
import type { ActionResult, StructuredOutput } from "../agent/types";
import { DEBUG } from "../debug";
import type { World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import type { GameState } from "./types";

export class GameEngine {
	private state: GameState;
	private agent: GameAgent;

	constructor(private world: World) {
		this.agent = new GameAgent(createModel());
		this.state = buildInitialState(world);
	}

	async processInput(input: string): Promise<ActionResult> {
		const trimmed = input.trim();
		if (!trimmed) {
			const result = { message: "Say something!", success: false };
			return this.agent.narrateResult(result);
		}

		const context = buildParserContext(this.world, this.state);
		DEBUG(`Context: ${JSON.stringify(context)}`);

		const intent = await this.agent.processIntent(trimmed, context);
		const result = this.runAction(intent);
		return this.agent.narrateResult(result);
	}

	private runAction(intent: StructuredOutput): ActionResult {
		// TODO implement real game logic (move, take, drop, use, etc.)
		DEBUG(`Action: ${intent.action} ${JSON.stringify(intent)}`);

		const message =
			intent.action === "respond" && intent.message != null
				? intent.message
				: intent.message ?? "Success!";

		return {
			message,
			success: true,
			gameOver: false,
			isVictory: false,
		};
	}

	isGameOver(): boolean {
		return false;
	}
}
