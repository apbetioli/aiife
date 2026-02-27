import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import { buildStructuredOutputSystemPrompt } from "./structured-output-prompt";
import {
	type StructuredOutput,
	type StructuredOutputEvalData,
	type StructuredOutputResult,
	StructuredOutputSchema,
} from "./types";

export async function structuredOutputExecutor(
	data: StructuredOutputEvalData,
): Promise<StructuredOutputResult> {
	const systemPrompt = buildStructuredOutputSystemPrompt(
		data.gameState,
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

	const parsed: StructuredOutput = result.output;

	// Strip null values so evaluators only see actual params
	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (key === "action") continue;
		if (value !== null) params[key] = value;
	}

	return {
		action: parsed.action,
		params,
		produced: true,
	};
}
