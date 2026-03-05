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

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

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
		const recentHistory = filterCompatibleMessages(conversationHistory).slice(
			-INTENT_HISTORY_LIMIT,
		);

		const system = buildStructuredOutputSystemPrompt(
			this.engine.getParserContext(),
			Object.keys(this.engine.getDescriptions()),
			this.engine.getDescriptions(),
		);

		const intentResult = await generateText({
			model: this.model,
			output: Output.object({ schema: StructuredOutputSchema }),
			messages: [
				{ role: "system", content: system },
				...recentHistory,
				{ role: "user", content: input },
			],
			abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
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

		// Return only the bounded history window for next call
		return [
			...recentHistory,
			{ role: "user", content: input },
			{ role: "assistant", content: outputText },
		];
	}

	private async narrate(
		result: ActionResult,
		playerInput: string,
		callbacks: AgentCallbacks,
	): Promise<string> {
		const prompt = `${NARRATION_SYSTEM_PROMPT}\n\nGame output:\n${result.message}\nPlayer language (match this): "${playerInput}"`;

		const stream = streamText({
			model: this.narratorModel,
			prompt,
			abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
		});

		let text = "";
		try {
			for await (const chunk of stream.fullStream) {
				if (chunk.type === "text-delta") {
					text += chunk.text;
					callbacks.onToken(chunk.text);
				}
			}
		} catch {
			// Narrator failed (timeout, connection, etc.) — use game output as-is
			text = result.message;
		}

		return text || result.message || "Done.";
	}
}
