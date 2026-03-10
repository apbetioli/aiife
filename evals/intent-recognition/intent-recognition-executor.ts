import { generateText, Output } from "ai";
import { createEvalModel } from "../../src/agent/model";
import type { RecognizedIntent } from "../../src/agent/types";
import { IntentRecognitionSchema } from "../../src/agent/types";
import type { IntentRecognitionEvalData, IntentRecognitionResult } from "../types";
import { buildIntentSystemPrompt } from "./intent-recognition-prompt";

export async function intentRecognitionExecutor(data: IntentRecognitionEvalData): Promise<IntentRecognitionResult> {
	const systemPrompt = buildIntentSystemPrompt(data.context, data.availableActions);

	const result = await generateText({
		model: createEvalModel(),
		output: Output.object({ schema: IntentRecognitionSchema }),
		system: systemPrompt,
		prompt: data.prompt,
		temperature: data.config?.temperature,
	});

	const { action, ...output }: RecognizedIntent = result.output;

	return {
		action,
		params: stripNullValues(output),
	};
}

function stripNullValues(output: Omit<RecognizedIntent, "action">): Record<string, unknown> {
	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(output)) {
		if (value !== null) params[key] = value;
	}
	return params;
}
