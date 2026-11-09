import { describe, expect, it } from "vitest";
import { buildScopedTools, buildToolSystemPrompt } from "../../src/agent/tool-builder";
import type { IntentRecognitionEvalData } from "../types";

describe("toolIntentRecognitionExecutor logic", () => {
	it("properly resolves scoped tools and system prompt for eval data", () => {
		const evalData: IntentRecognitionEvalData = {
			prompt: "take the brass lantern",
			context: {
				room: "The Great Hall",
				description: "A vast stone hall.",
				available_exits: ["north", "west"],
				in_scope_objects: [
					{
						id: "brass_lantern",
						name: "brass lantern",
						aliases: [],
						type: "item",
						state: { carriable: true },
						source: "room",
					},
				],
			},
			availableActions: ["go", "take", "drop", "open", "talk", "inventory", "help", "respond"],
		};

		const tools = buildScopedTools(evalData.context, {
			availableActions: evalData.availableActions,
			scopeTools: true,
		});

		// Go and take are valid
		expect(tools.go).toBeDefined();
		expect(tools.take).toBeDefined();
		expect(tools.respond).toBeDefined();

		// Drop and talk should be pruned
		expect(tools.drop).toBeUndefined();
		expect(tools.talk).toBeUndefined();

		const prompt = buildToolSystemPrompt(evalData.context);
		expect(prompt).toContain("The Great Hall");
		expect(prompt).toContain("north, west");
		expect(prompt).toContain("brass lantern");
	});
});
