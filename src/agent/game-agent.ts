import {
	generateText,
	type LanguageModel,
	type ModelMessage,
	Output,
} from "ai";
import {
	buildStructuredOutputSystemPrompt,
} from "../../evals/structured-output-prompt";
import { DEBUG } from "../debug";
import type { ParserContext } from "../world/types";
import { NARRATION_SYSTEM_PROMPT } from "./prompt";
import type { ActionResult, StructuredOutput } from "./types";
import { StructuredOutputSchema } from "./types";

const INTENT_HISTORY_LIMIT = 10;

export class GameAgent {
	private messages: ModelMessage[] = [];

	constructor(
		private model: LanguageModel,
		private descriptions: Record<string, string>,
	) {}

	/**
	 * Used by the game engine to process the player's input and return the structured output of the intent.
	 *
	 * @param prompt - The player's input.
	 * @param context - The current game state.
	 * @returns The structured output of the intent.
	 */
	async processIntent(
		prompt: string,
		context: ParserContext,
	): Promise<StructuredOutput> {
		this.messages.push({ role: "user", content: prompt });

		const system = buildStructuredOutputSystemPrompt(
			context,
			Object.keys(this.descriptions),
			this.descriptions,
		);
		DEBUG(`System: ${system}`);

		const result = await generateText({
			model: this.model,
			output: Output.object({ schema: StructuredOutputSchema }),
			system,
			// Gives context about recent interactions for solving ambiguous inputs in follow up answers.
			// E.g. "TAKE" → "What do you want to take?" → "lantern" -> "Taken."
			messages: this.messages.slice(-INTENT_HISTORY_LIMIT),
		});

		return result.output;
	}

	/**
	 * Used by the game engine to narrate the result of an action, which can be in the user's language.
	 *
	 * @param result - The result of an action.
	 * @returns The narrated result.
	 */
	async narrateResult(result: ActionResult): Promise<ActionResult> {
		const prompt = `${NARRATION_SYSTEM_PROMPT}\n\nCurrent game output to narrate:\n${result.message}`;

		const narrateResponse = await generateText({
			model: this.model,
			prompt,
		});

		const text = narrateResponse.text || result.message;
		this.messages.push({ role: "assistant", content: text });

		return { ...result, message: text };
	}
}
