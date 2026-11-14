import { getTracer } from "@lmnr-ai/lmnr";
import { generateText, type LanguageModel, type ModelMessage, streamText } from "ai";
import type { GameEngine } from "../engine/game-engine";
import { splitCommands, tryDeterministicIntent } from "./fast-path-parser";
import { filterCompatibleMessages } from "./system/filter-messages";
import { NARRATION_SYSTEM_PROMPT } from "./system/narration-prompt";
import { buildScopedTools, buildToolSystemPrompt } from "./tool-builder";
import type { AgentCallbacks, RecognizedIntent } from "./types";

const INTENT_HISTORY_LIMIT = 10;
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;

export const CACHE_PROVIDER_OPTIONS = {
	anthropic: { cacheControl: { type: "ephemeral" as const } },
};

export function cachedSystemPrompt(content: string) {
	return [
		{
			role: "system" as const,
			content,
			providerOptions: CACHE_PROVIDER_OPTIONS,
		},
	];
}

function getCommonCallOptions() {
	return {
		abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
		providerOptions: CACHE_PROVIDER_OPTIONS,
		experimental_telemetry: {
			isEnabled: true,
			tracer: getTracer(),
		},
	};
}

function extractIntent(
	toolCall: { toolName: string; input?: unknown; args?: unknown } | undefined,
	fallbackText: string,
): RecognizedIntent {
	if (!toolCall) {
		return { action: "respond", message: fallbackText || "I don't understand that." };
	}
	const params = (toolCall.input ?? toolCall.args ?? {}) as Record<string, unknown>;
	return { action: toolCall.toolName, ...params };
}

export class GameAgent {
	constructor(
		private model: LanguageModel,
		private engine: GameEngine,
		private narratorModel: LanguageModel = model,
	) {}

	async run(input: string, conversationHistory: ModelMessage[], callbacks: AgentCallbacks): Promise<ModelMessage[]> {
		const recentHistory = filterCompatibleMessages(conversationHistory).slice(-INTENT_HISTORY_LIMIT);
		const commands = splitCommands(input);

		if (commands.length === 0) {
			callbacks.onComplete("");
			return recentHistory;
		}

		const outputs: string[] = [];
		const workingHistory: ModelMessage[] = [...recentHistory];

		for (let i = 0; i < commands.length; i++) {
			const cmd = commands[i];

			try {
				const fastIntent = tryDeterministicIntent(cmd);
				let intent: RecognizedIntent | null = null;

				if (fastIntent && this.engine.getActionRegistry().has(fastIntent.action)) {
					intent = fastIntent;
				} else {
					const context = this.engine.getParserContext();
					const tools = buildScopedTools(context, {
						registry: this.engine.getActionRegistry(),
					});
					const system = buildToolSystemPrompt(context);

					const {
						toolCalls,
						text,
						usage: toolUsage,
					} = await generateText({
						model: this.model,
						system: cachedSystemPrompt(system),
						tools,
						toolChoice: "required",
						messages: [...workingHistory, { role: "user", content: cmd }],
						...getCommonCallOptions(),
					});

					intent = extractIntent(toolCalls?.[0], text);

					if (toolUsage) {
						callbacks.onTokenUsage?.(toolUsage);
					}
				}

				const result = this.engine.runAction(intent);

				if (i > 0 && outputs.length > 0) {
					callbacks.onToken("\n");
				}

				const outputText = await this.narrate(result, cmd, callbacks);
				outputs.push(outputText);

				workingHistory.push({ role: "user", content: cmd });
				workingHistory.push({ role: "assistant", content: outputText });

				if (this.engine.wasLastActionStopped() || this.engine.isGameOver() || intent.action === "respond") {
					break;
				}
			} catch (err) {
				const errMsg = err instanceof Error ? err.message : String(err);
				if (i > 0 && outputs.length > 0) {
					callbacks.onToken("\n");
				}
				outputs.push(`Error: ${errMsg}`);
				break;
			}
		}

		const combinedOutput = outputs.join("\n");
		callbacks.onComplete(combinedOutput);

		return [...recentHistory, { role: "user", content: input }, { role: "assistant", content: combinedOutput }];
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
				system: cachedSystemPrompt(NARRATION_SYSTEM_PROMPT),
				prompt: `Game output:\n${message}\n\nMatch the language of this player input (do not include it in your response): "${playerInput}"`,
				...getCommonCallOptions(),
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
