import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import { buildStructuredOutputSystemPrompt } from "./structured-output-prompt";
import type { StructuredOutputEvalData, StructuredOutputResult } from "./types";

const GameActionSchema = z.object({
	action: z.string(),
	params: z.object({
		direction: z.string().nullable(),
		target: z.string().nullable(),
		items: z.array(z.string()).nullable(),
		npc: z.string().nullable(),
		message: z.string().nullable(),
	}),
});

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
		output: Output.object({ schema: GameActionSchema }),
		system: systemPrompt,
		prompt: data.prompt,
		temperature: data.config?.temperature,
	});

	const parsed = result.output;

	// Strip null values so evaluators only see actual params
	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(parsed.params)) {
		if (value !== null) params[key] = value;
	}

	return {
		action: parsed.action,
		params,
		produced: true,
	};
}
