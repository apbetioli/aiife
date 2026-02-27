import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

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
		model: openai(
			process.env.EVAL_MODEL ?? data.config?.model ?? "gpt-4o-mini",
		),
		output: Output.object({ schema: StructuredOutputSchema }),
		system: systemPrompt,
		prompt: data.prompt,
		temperature: data.config?.temperature,
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
