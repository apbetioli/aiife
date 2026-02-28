import {
	generateText,
	type LanguageModel,
	type ModelMessage,
	Output,
} from "ai";
import {
	ACTION_DESCRIPTIONS,
	buildStructuredOutputSystemPrompt,
} from "../../evals/structured-output-prompt";
import { DEBUG } from "../debug";
import type { ParserContext } from "../world/types";
import { NARRATION_SYSTEM_PROMPT } from "./prompt";
import type { ActionResult } from "./types";
import { StructuredOutputSchema } from "./types";

export class GameAgent {
	private messages: ModelMessage[] = [];

	constructor(private model: LanguageModel) {}

	async processIntent(prompt: string, context: ParserContext) {
		this.messages.push({ role: "user", content: prompt });

		const system = buildStructuredOutputSystemPrompt(
			context,
			Object.keys(ACTION_DESCRIPTIONS),
		);
		DEBUG(`System: ${system}`);

		const result = await generateText({
			model: this.model,
			output: Output.object({ schema: StructuredOutputSchema }),
			system,
			messages: this.messages.slice(-20),
		});

		return result.output;
	}

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
