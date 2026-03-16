import { getTracer } from "@lmnr-ai/lmnr";
import { generateText, Output } from "ai";
import { createEvalModel } from "../../src/agent/model";
import { buildIntentSystemPrompt } from "../../src/agent/system/intent-recognition-prompt";
import type { RecognizedIntent } from "../../src/agent/types";
import { IntentRecognitionSchema } from "../../src/agent/types";
import type { IntentRecognitionEvalData, IntentRecognitionResult } from "../types";

export async function intentRecognitionExecutor(data: IntentRecognitionEvalData): Promise<IntentRecognitionResult> {
	const systemPrompt = buildIntentSystemPrompt(data.context, data.availableActions);

	const result = await generateText({
		model: createEvalModel(),
		output: Output.object({ schema: IntentRecognitionSchema }),
		system: systemPrompt,
		prompt: data.prompt,
		temperature: data.config?.temperature,
		experimental_telemetry: {
			isEnabled: true,
			tracer: getTracer(),
		},
	});

	const { action, message, ...output }: RecognizedIntent = result.output;

	return {
		action,
		params: stripEmptyValues(action === "respond" ? { message, ...output } : output),
	};
}

function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (value === "null") return true;
	if (Array.isArray(value) && value.length === 0) return true;
	return false;
}

function stripEmptyValues(output: Record<string, unknown>) {
	return Object.fromEntries(Object.entries(output).filter(([_, value]) => !isEmptyValue(value)));
}
