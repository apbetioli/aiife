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
	// TODO limit the number of messages
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
			prompt,
		});

		this.messages.push(...(result.response.messages as ModelMessage[]));

		return result.output;
	}

	async narrateResult(result: ActionResult): Promise<ActionResult> {
		this.messages.push({ role: "system", content: result.message });

		const narrateResponse = await generateText({
			model: this.model,
			system: NARRATION_SYSTEM_PROMPT,
			messages: this.messages,
		});

		const text = narrateResponse.text || result.message;
		this.messages.push({ role: "assistant", content: text });

		return { ...result, message: text };
	}
}
