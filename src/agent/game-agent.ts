import { getTracer } from "@lmnr-ai/lmnr";
import { generateText, type LanguageModel, type ModelMessage, Output, streamText } from "ai";
import type { GameEngine } from "../engine/game-engine";
import type { AgentCallbacks } from "../types";
import { filterCompatibleMessages } from "./system/filterMessages";
import { buildIntentSystemPrompt as buildIntentRecognitionSystemPrompt } from "./system/intent-recognition-prompt";
import { NARRATION_SYSTEM_PROMPT } from "./system/narration-prompt";
import { IntentRecognitionSchema } from "./types";

const INTENT_HISTORY_LIMIT = 10;

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export class GameAgent {
	constructor(
		private model: LanguageModel,
		private engine: GameEngine,
		private narratorModel: LanguageModel = model,
	) {}

	async run(input: string, conversationHistory: ModelMessage[], callbacks: AgentCallbacks): Promise<ModelMessage[]> {
		const recentHistory = filterCompatibleMessages(conversationHistory).slice(-INTENT_HISTORY_LIMIT);

		const meta = this.engine.getIntentMeta();
		const system = buildIntentRecognitionSystemPrompt(
			this.engine.getParserContext(),
			Object.keys(meta),
			meta,
		);

		const { output: intent, usage: intentUsage } = await generateText({
			model: this.model,
			output: Output.object({ schema: IntentRecognitionSchema }),
			messages: [{ role: "system", content: system }, ...recentHistory, { role: "user", content: input }],
			abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
			experimental_telemetry: {
				isEnabled: true,
				tracer: getTracer(),
			},
		});

		const result = this.engine.runAction(intent);

		if (intentUsage) {
			callbacks.onTokenUsage?.(intentUsage);
		}
		const outputText = await this.narrate(result, input, callbacks);

		callbacks.onComplete(outputText);

		return [...recentHistory, { role: "user", content: input }, { role: "assistant", content: outputText }];
	}

	private async narrate(message: string, playerInput: string, callbacks: AgentCallbacks): Promise<string> {
		const fallback = message || "Done.";

		try {
			const prompt = `${NARRATION_SYSTEM_PROMPT}\n\nGame output:\n${message}\nPlayer language (match this): "${playerInput}"`;

			const stream = streamText({
				model: this.narratorModel,
				prompt,
				abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
				experimental_telemetry: {
					isEnabled: true,
					tracer: getTracer(),
				},
			});

			let text = "";
			for await (const chunk of stream.fullStream) {
				if (chunk.type === "text-delta") {
					text += chunk.text;
					callbacks.onToken(chunk.text);
				}
				if (chunk.type === "finish" && chunk.totalUsage) {
					callbacks.onTokenUsage?.(chunk.totalUsage);
				}
			}
			return text || fallback;
		} catch {
			return fallback;
		}
	}
}
