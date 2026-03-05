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

export class GameAgent {
	constructor(
		private model: LanguageModel,
		private engine: GameEngine,
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

		let uiCurrentText = "";
		let streamError: Error | null = null;

		const narrateResult = streamText({
			model: this.model,
			prompt: buildNarrationPrompt(result, messages),
		});

		try {
			for await (const chunk of narrateResult.fullStream) {
				if (chunk.type === "text-delta") {
					uiCurrentText += chunk.text;
					callbacks.onToken(chunk.text);
				}
			}
		} catch (error: unknown) {
			streamError = error as Error;
			if (
				!uiCurrentText &&
				!streamError.message.includes("No output generated")
			) {
				throw streamError;
			}
		}

		if (streamError && !uiCurrentText) {
			uiCurrentText +=
				"Sorry about that, I'm having trouble with my memory. Let's try again.";
			callbacks.onToken(uiCurrentText);
		}

		const responseMessage = await narrateResult.response;
		messages.push(...responseMessage.messages);

		callbacks.onComplete(uiCurrentText);

		return messages;
	}
}

function getLastUserContent(messages: ModelMessage[]): string | undefined {
	const lastUser = [...messages].reverse().find((m) => m.role === "user");
	return lastUser && typeof lastUser.content === "string"
		? lastUser.content
		: undefined;
}

function buildNarrationPrompt(
	result: ActionResult,
	messages: ModelMessage[],
): string {
	const isGeneric = !result.message.trim() || result.message.trim() === "Done.";
	const actionHint =
		isGeneric && result.action
			? `\nAction performed (use for confirmation only): ${result.action}`
			: "";
	const lastInput = getLastUserContent(messages);
	const languageHint = lastInput
		? `\nPlayer's last input (respond in this language): ${lastInput}`
		: "";
	return `${NARRATION_SYSTEM_PROMPT}\n\nCurrent game output to narrate:\n${result.message}${actionHint}${languageHint}`;
}
