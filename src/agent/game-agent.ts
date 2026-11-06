import { getTracer } from "@lmnr-ai/lmnr";
import { generateText, type LanguageModel, type ModelMessage, Output, streamText } from "ai";
import type { GameEngine } from "../engine/game-engine";
import type { AgentCallbacks } from "../types";
import { tryDeterministicIntent } from "./fast-path-parser";
import { filterCompatibleMessages } from "./system/filterMessages";
import { buildIntentSystemPrompt as buildIntentRecognitionSystemPrompt } from "./system/intent-recognition-prompt";
import { NARRATION_SYSTEM_PROMPT } from "./system/narration-prompt";
import { IntentRecognitionSchema, type RecognizedIntent } from "./types";

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

		// Fast-path standard unambiguous commands to bypass LLM intent extraction
		const fastIntent = tryDeterministicIntent(input);
		let intent: RecognizedIntent;

		if (fastIntent) {
			intent = fastIntent;
		} else {
			const meta = this.engine.getIntentMeta();
			const system = buildIntentRecognitionSystemPrompt(this.engine.getParserContext(), Object.keys(meta), meta);

			const { output: llmIntent, usage: intentUsage } = await generateText({
				model: this.model,
				output: Output.object({ schema: IntentRecognitionSchema }),
				messages: [{ role: "system", content: system }, ...recentHistory, { role: "user", content: input }],
				abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
				experimental_telemetry: {
					isEnabled: true,
					tracer: getTracer(),
				},
			});

			intent = llmIntent;
			if (intentUsage) {
				callbacks.onTokenUsage?.(intentUsage);
			}
		}

		const result = this.engine.runAction(intent);
		const outputText = await this.narrate(result, input, callbacks);

		callbacks.onComplete(outputText);

		return [...recentHistory, { role: "user", content: input }, { role: "assistant", content: outputText }];
	}

	private async narrate(message: string, playerInput: string, callbacks: AgentCallbacks): Promise<string> {
		const fallback = message || "Done.";

		const hasExplicitNarrator = Boolean(process.env.NARRATOR_PROVIDER);
		const hasNonAscii = [...playerInput].some((c) => (c.codePointAt(0) ?? 0) > 127);
		if (!hasExplicitNarrator && !hasNonAscii && fallback !== "Done.") {
			callbacks.onToken(fallback);
			return fallback;
		}

		try {
			const stream = streamText({
				model: this.narratorModel,
				system: NARRATION_SYSTEM_PROMPT,
				prompt: `Game output:\n${message}\n\nMatch the language of this player input (do not include it in your response): "${playerInput}"`,
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
