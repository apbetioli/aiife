import { getTracer } from "@lmnr-ai/lmnr";
import { generateText } from "ai";
import { createEvalModel } from "../../src/agent/model";
import { buildScopedTools, buildToolSystemPrompt } from "../../src/agent/tool-builder";
import type { IntentRecognitionEvalData, IntentRecognitionResult } from "../types";

export interface ToolExecutorOptions {
	scopeTools?: boolean;
}

export async function toolIntentRecognitionExecutor(
	data: IntentRecognitionEvalData,
	options: ToolExecutorOptions = {},
): Promise<IntentRecognitionResult> {
	const shouldScope = options.scopeTools ?? process.env.EVAL_SCOPE_TOOLS !== "false";

	const tools = buildScopedTools(data.context, {
		availableActions: data.availableActions,
		scopeTools: shouldScope,
	});

	const systemPrompt = buildToolSystemPrompt(data.context);

	const result = await generateText({
		model: createEvalModel(),
		system: systemPrompt,
		tools,
		toolChoice: "required",
		prompt: data.prompt,
		temperature: data.config?.temperature,
		experimental_telemetry: {
			isEnabled: true,
			tracer: getTracer(),
		},
	});

	const toolCall = result.toolCalls?.[0];

	if (!toolCall) {
		return {
			action: "respond",
			params: stripEmptyValues({ message: result.text }),
		};
	}

	const action = toolCall.toolName;
	const params = ((toolCall as { input?: unknown }).input ?? (toolCall as { args?: unknown }).args ?? {}) as Record<
		string,
		unknown
	>;

	return {
		action,
		params: stripEmptyValues(params),
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
