import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { makeTestWorld } from "../engine/__fixtures__/test-world";
import { GameEngine } from "../engine/game-engine";
import { GameAgent } from "./game-agent";

describe("GameAgent", () => {
	function setup(model?: MockLanguageModelV3) {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		const mockModel =
			model ??
			new MockLanguageModelV3({
				doGenerate: async () => ({
					rawCall: { rawPrompt: null, rawSettings: {} },
					finishReason: "stop",
					usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
					content: [{ type: "text", text: "mock response" }],
				}),
			});

		const agent = new GameAgent(mockModel, engine, mockModel);
		return { agent, engine, mockModel };
	}

	it("executes deterministic fast-path commands without invoking the LLM", async () => {
		const doGenerate = vi.fn();
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent } = setup(mockModel);

		const tokens: string[] = [];
		let completed = "";

		const history = await agent.run("look", [], {
			onToken: (t) => tokens.push(t),
			onComplete: (c) => {
				completed = c;
			},
		});

		expect(doGenerate).not.toHaveBeenCalled();
		expect(completed).toContain("Room A");
		expect(history).toHaveLength(2);
		expect(history[0]).toEqual({ role: "user", content: "look" });
		expect(history[1].role).toBe("assistant");
	});

	it("invokes LLM scoped tools on complex input and executes the tool call", async () => {
		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "tool-calls",
			usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
			content: [
				{
					type: "tool-call",
					toolCallId: "call_1",
					toolName: "take",
					input: JSON.stringify({ objects: ["lamp"] }),
				},
			],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent, engine } = setup(mockModel);

		let completed = "";
		const tokenUsages: unknown[] = [];

		await agent.run("please pick up the shiny brass lamp", [], {
			onToken: () => {},
			onComplete: (c) => {
				completed = c;
			},
			onTokenUsage: (u) => tokenUsages.push(u),
		});

		expect(doGenerate).toHaveBeenCalled();
		expect(completed).toBe("Taken.");
		expect(tokenUsages).toHaveLength(1);
		expect(engine.save().state.objects.lamp.location).toBe("inventory");
	});

	it("handles respond tool calls for conversational queries", async () => {
		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "tool-calls",
			usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
			content: [
				{
					type: "tool-call",
					toolCallId: "call_2",
					toolName: "respond",
					input: JSON.stringify({ message: "I am a helpful narrator." }),
				},
			],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent } = setup(mockModel);

		let completed = "";

		await agent.run("who are you?", [], {
			onToken: () => {},
			onComplete: (c) => {
				completed = c;
			},
		});

		expect(doGenerate).toHaveBeenCalled();
		expect(completed).toBe("I am a helpful narrator.");
	});

	it("falls back gracefully when no tool call is generated", async () => {
		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "stop",
			usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
			content: [{ type: "text", text: "I did not understand that." }],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent } = setup(mockModel);

		let completed = "";

		await agent.run("something weird", [], {
			onToken: () => {},
			onComplete: (c) => {
				completed = c;
			},
		});

		expect(completed).toBe("I did not understand that.");
	});
});
