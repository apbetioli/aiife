import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, type ToolSet } from "ai";

import {
	ActionRegistry,
	registerBuiltinActions,
} from "../src/engine/ActionRegistry";
import type { EvalData, SingleTurnResult } from "./types";
import { buildMessages } from "./utils";

const registry = new ActionRegistry();
registerBuiltinActions(registry);
const toolDefinitions = registry.getTools();

console.log(toolDefinitions);

/**
 * Single-turn executor with mocked tools.
 * Uses predefined tool definitions - tools never execute, only selection is tested.
 */
export const singleTurnExecutorWithMocks = async (
	data: EvalData,
): Promise<SingleTurnResult> => {
	const tools: ToolSet = Object.fromEntries(
		data.tools
			.filter((toolName) => toolName in toolDefinitions)
			.map((toolName) => [toolName, toolDefinitions[toolName]]),
	);

	const result = await generateText({
		model: openai(
			process.env.EVAL_MODEL ?? data.config?.model ?? "gpt-4o-mini",
		),
		messages: buildMessages(data),
		tools: tools,
		stopWhen: stepCountIs(1),
		temperature: data.config?.temperature ?? undefined, // If the model supports it
	});

	// const actionResponse = await generateText({
	//   model: this.model,
	//   maxOutputTokens: 1024,
	//   system: `${AGENT_SYSTEM_PROMPT}\n\n${buildGameStatePrompt(this.state)}`,
	//   tools,
	//   toolChoice: "required",
	//   messages: this.messages,
	// });

	// Extract tool calls from the result
	const toolCalls = (result.toolCalls ?? []).map((tc) => ({
		toolName: tc.toolName,
		args: "args" in tc ? tc.args : {},
	}));

	const toolNames = toolCalls.map((tc) => tc.toolName);

	return {
		toolCalls,
		toolNames,
		selectedAny: toolNames.length > 0,
	};
};
