import { getTracer } from "@lmnr-ai/lmnr";
import { generateText, Output } from "ai";
import { createEvalModel } from "../src/agent/model";
import type {
	StructuredOutput,
	StructuredOutputResult,
} from "../src/agent/types";
import { StructuredOutputSchema } from "../src/agent/types";
import { buildStructuredOutputSystemPrompt } from "./structured-output-prompt";
import type { StructuredOutputEvalData } from "./types";

export async function structuredOutputExecutor(
	data: StructuredOutputEvalData,
): Promise<StructuredOutputResult> {
	const systemPrompt = buildStructuredOutputSystemPrompt(
		data.context,
		data.availableActions,
	);

	const result = await generateText({
		model: createEvalModel(),
		output: Output.object({ schema: StructuredOutputSchema }),
		system: systemPrompt,
		prompt: data.prompt,
		temperature: data.config?.temperature,
		experimental_telemetry: {
			isEnabled: true,
			tracer: getTracer(),
		},
	});

	const { action, ...output }: StructuredOutput = result.output;

	return {
		action,
		params: stripNullValues(output),
	};
}

function stripNullValues(
	output: Omit<StructuredOutput, "action">,
): Record<string, unknown> {
	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(output)) {
		if (value !== null) params[key] = value;
	}
	return params;
}
