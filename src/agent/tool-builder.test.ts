import { describe, expect, it } from "vitest";
import type { ParserContext } from "../world/types";
import { buildScopedTools, buildToolSystemPrompt } from "./tool-builder";

describe("tool-builder", () => {
	const mockContext: ParserContext = {
		room: "Great Hall",
		description: "A grand hall.",
		available_exits: ["north", "south"],
		in_scope_objects: [
			{
				id: "lantern",
				name: "brass lantern",
				aliases: ["lamp"],
				type: "item",
				state: { carriable: true },
				source: "room",
			},
			{
				id: "chest",
				name: "wooden chest",
				aliases: ["box"],
				type: "container",
				state: { open: false },
				source: "room",
			},
		],
	};

	it("scopes tools according to room context", () => {
		const tools = buildScopedTools(mockContext, {
			availableActions: ["go", "take", "drop", "open", "close", "talk", "respond"],
			scopeTools: true,
		});

		// "go" is in scope because exits exist
		expect(tools.go).toBeDefined();
		// "take" is in scope because room has carriable items
		expect(tools.take).toBeDefined();
		// "open" is in scope because chest is closed
		expect(tools.open).toBeDefined();
		// "respond" is always in scope
		expect(tools.respond).toBeDefined();

		// "drop" should NOT be in scope because inventory is empty
		expect(tools.drop).toBeUndefined();
		// "close" should NOT be in scope because chest is not open
		expect(tools.close).toBeUndefined();
		// "talk" should NOT be in scope because there are no actors
		expect(tools.talk).toBeUndefined();
	});

	it("returns all tools when scopeTools is false", () => {
		const tools = buildScopedTools(mockContext, {
			availableActions: ["go", "take", "drop", "open", "close", "talk", "respond"],
			scopeTools: false,
		});

		expect(tools.go).toBeDefined();
		expect(tools.take).toBeDefined();
		expect(tools.drop).toBeDefined();
		expect(tools.open).toBeDefined();
		expect(tools.close).toBeDefined();
		expect(tools.talk).toBeDefined();
		expect(tools.respond).toBeDefined();
	});

	it("builds a clean tool system prompt with state and entity rules", () => {
		const prompt = buildToolSystemPrompt(mockContext);
		expect(prompt).toContain("Great Hall");
		expect(prompt).toContain("north, south");
		expect(prompt).toContain("brass lantern aka lamp (item, carriable) [lantern]");
		expect(prompt).toContain("wooden chest aka box (container) [chest]");
	});
});
