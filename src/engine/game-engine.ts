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
		if (!trimmed) return { message: "Say something!", success: false };

		const context = buildParserContext(this.world, this.state);
		DEBUG(`Context: ${JSON.stringify(context)}`);

		const actionIntent = await this.agent.processIntent(trimmed, context);

		const result = this.run(actionIntent);

		return this.agent.narrateResult(result);
	}

	private run(_actionIntent: StructuredOutput): ActionResult {
		// TODO implement game logic
		DEBUG(`Action intent: ${JSON.stringify(_actionIntent)}`);

		return {
			message: _actionIntent.message || "Success!",
			success: true,
			gameOver: false,
			isVictory: false,
		};
	}

	isGameOver(): boolean {
		return false;
	}
}
