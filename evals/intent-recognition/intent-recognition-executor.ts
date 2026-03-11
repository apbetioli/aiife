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

	const { action, ...output }: RecognizedIntent = result.output;

	return {
		action,
		params: stripNullValues(output),
	};
}

function stripNullValues(output: Omit<RecognizedIntent, "action">) {
	return Object.fromEntries(Object.entries(output).filter(([_, value]) => value !== null));
}
