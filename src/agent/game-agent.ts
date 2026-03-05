import {
	generateText,
	type LanguageModel,
	type ModelMessage,
	Output,
	streamText,
} from "ai";
import { buildStructuredOutputSystemPrompt } from "../../evals/structured-output-prompt";
import type { GameEngine } from "../engine/game-engine";
import type { AgentCallbacks } from "../types";
import { NARRATION_SYSTEM_PROMPT } from "./prompt";
import { filterCompatibleMessages } from "./system/filterMessages";
import type { ActionResult } from "./types";
import { StructuredOutputSchema } from "./types";

const INTENT_HISTORY_LIMIT = 10;

/** Returns true if input contains non-ASCII characters (likely non-English). */
function needsTranslation(input: string): boolean {
	return !/^[\x20-\x7E]*$/.test(input);
}

export class GameAgent {
	constructor(
		private model: LanguageModel,
		private engine: GameEngine,
		private narratorModel: LanguageModel = model,
	) {}

	async run(
		input: string,
		conversationHistory: ModelMessage[],
		callbacks: AgentCallbacks,
	): Promise<ModelMessage[]> {
		const workingHistory = filterCompatibleMessages(conversationHistory);

		const system = buildStructuredOutputSystemPrompt(
			this.engine.getParserContext(),
			Object.keys(this.engine.getDescriptions()),
			this.engine.getDescriptions(),
		);

		const messages: ModelMessage[] = [
			{ role: "system", content: system },
			// Gives context about recent interactions for solving ambiguous inputs in follow up answers.
			// E.g. "TAKE" → "What do you want to take?" → "lantern" -> "Taken."
			...workingHistory.slice(-INTENT_HISTORY_LIMIT),
			{ role: "user", content: input },
		];

		const intentResult = await generateText({
			model: this.model,
			output: Output.object({ schema: StructuredOutputSchema }),
			messages,
		});

		const intent = intentResult.output;
		const { action, ...params } = intent;
		callbacks.onToolCallStart(action, params);

		const result = this.engine.runAction(intent);
		callbacks.onToolCallEnd(action, result.message);

		let outputText: string;

		if (needsTranslation(input)) {
			outputText = await this.narrate(result, input, callbacks);
		} else {
			outputText = result.message || "Done.";
			callbacks.onToken(outputText);
		}

		callbacks.onComplete(outputText);
		messages.push({ role: "assistant", content: outputText });

		return messages;
	}

	private async narrate(
		result: ActionResult,
		playerInput: string,
		callbacks: AgentCallbacks,
	): Promise<string> {
		const prompt = `${NARRATION_SYSTEM_PROMPT}\n\nGame output:\n${result.message}\nPlayer language (match this): "${playerInput}"`;

		const stream = streamText({ model: this.narratorModel, prompt });

		let text = "";
		try {
			for await (const chunk of stream.fullStream) {
				if (chunk.type === "text-delta") {
					text += chunk.text;
					callbacks.onToken(chunk.text);
				}
			}
		} catch (error: unknown) {
			if (!text && !(error as Error).message?.includes("No output generated")) {
				throw error;
			}
		}

		return text || result.message || "Done.";
	}
}
