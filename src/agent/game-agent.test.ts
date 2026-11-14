import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { makeTestWorld } from "../engine/__fixtures__/test-world";
import { GameEngine } from "../engine/game-engine";
import { recreateStateFromHistory } from "../engine/save";
import type { GameObject } from "../world/types";
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
					finishReason: { unified: "stop", raw: "stop" },
					usage: {
						inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
						outputTokens: { total: 5, text: 5, reasoning: 0 },
					},
					content: [{ type: "text", text: "mock response" }],
					warnings: [],
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

	it("drops plural objects ('drop swords') via LLM entity resolution", async () => {
		const baseWorld = makeTestWorld();
		const world = makeTestWorld({
			objects: {
				...baseWorld.objects,
				metal_sword: {
					id: "metal_sword",
					name: "metal sword",
					aliases: [],
					type: "item",
					location: "inventory",
					state: { carriable: true },
					descriptions: { default: "A metal sword." },
				},
				wooden_sword: {
					id: "wooden_sword",
					name: "wooden sword",
					aliases: [],
					type: "item",
					location: "inventory",
					state: { carriable: true },
					descriptions: { default: "A wooden sword." },
				},
			},
		});
		const engine = new GameEngine(world);
		engine.start();

		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "tool-calls",
			usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
			content: [
				{
					type: "tool-call",
					toolCallId: "call_drop",
					toolName: "drop",
					input: JSON.stringify({ objects: ["metal_sword", "wooden_sword"] }),
				},
			],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const agent = new GameAgent(mockModel, engine, mockModel);

		let completed = "";
		await agent.run("drop swords", [], {
			onToken: () => {},
			onComplete: (c) => {
				completed = c;
			},
		});

		expect(doGenerate).toHaveBeenCalled();
		expect(completed).toBe("Dropped.");
		const saved = engine.save().state;
		expect(saved.objects.metal_sword.location).toBe("room_a");
		expect(saved.objects.wooden_sword.location).toBe("room_a");
	});

	it("routes entity commands directly to the LLM agent", async () => {
		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "tool-calls",
			usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
			content: [
				{
					type: "tool-call",
					toolCallId: "call_respond",
					toolName: "respond",
					input: JSON.stringify({ message: "You don't have any shields." }),
				},
			],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent } = setup(mockModel);

		let completed = "";
		await agent.run("drop shield", [], {
			onToken: () => {},
			onComplete: (c) => {
				completed = c;
			},
		});

		expect(doGenerate).toHaveBeenCalled();
		expect(completed).toBe("You don't have any shields.");
	});

	it("passes anthropic ephemeral cacheControl providerOptions to LLM calls", async () => {
		const doGenerate = vi.fn().mockResolvedValue({
			rawCall: { rawPrompt: null, rawSettings: {} },
			finishReason: "tool-calls",
			usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
			content: [
				{
					type: "tool-call",
					toolCallId: "call_look",
					toolName: "look",
					input: JSON.stringify({}),
				},
			],
		});
		const mockModel = new MockLanguageModelV3({ doGenerate });
		const { agent } = setup(mockModel);

		await agent.run("examine the surrounding chamber", [], {
			onToken: () => {},
			onComplete: () => {},
		});

		expect(doGenerate).toHaveBeenCalled();
		const callArgs = doGenerate.mock.calls[0]?.[0];
		expect(callArgs?.providerOptions?.anthropic).toEqual({
			cacheControl: { type: "ephemeral" },
		});
		const systemMessage = callArgs?.prompt?.find((p: { role: string }) => p.role === "system");
		expect(systemMessage?.providerOptions?.anthropic).toEqual({
			cacheControl: { type: "ephemeral" },
		});
	});

	describe("Multi-command chaining (Ticket #48)", () => {
		it("executes multiple fast-path commands chained with periods without LLM", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent } = setup(mockModel);

			let completed = "";
			const tokens: string[] = [];

			await agent.run("look. wait", [], {
				onToken: (t) => tokens.push(t),
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("Room A");
			expect(completed).toContain("Time passes...");
			expect(tokens.join("")).toBe(completed);
		});

		it("executes multiple commands separated by semicolons and newlines", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent } = setup(mockModel);

			let completedSemi = "";
			await agent.run("look; wait; inventory", [], {
				onToken: () => {},
				onComplete: (c) => {
					completedSemi = c;
				},
			});
			expect(completedSemi).toContain("Room A");
			expect(completedSemi).toContain("Time passes...");
			expect(completedSemi).toContain("iron sword");

			let completedNewline = "";
			await agent.run("wait\ninventory", [], {
				onToken: () => {},
				onComplete: (c) => {
					completedNewline = c;
				},
			});
			expect(completedNewline).toContain("Time passes...");
			expect(completedNewline).toContain("iron sword");
		});

		it("executes period-chained commands without spaces (e.g. DOWN.SOUTH.WEST.UP)", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent, engine } = setup(mockModel);

			// In test world: room_a has south -> room_b; room_b has south -> room_a
			let completed = "";
			await agent.run("SOUTH.SOUTH", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("Room B");
			expect(completed).toContain("Room A");
			expect(engine.save().state.player.current_room).toBe("room_a");
		});

		it("executes mixed deterministic and LLM-driven commands in sequence, updating context turn-by-turn", async () => {
			// Step 1: LLM takes lamp, Step 2: fast-path south
			const doGenerate = vi.fn().mockResolvedValue({
				rawCall: { rawPrompt: null, rawSettings: {} },
				finishReason: "tool-calls",
				usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
				content: [
					{
						type: "tool-call",
						toolCallId: "call_take_lamp",
						toolName: "take",
						input: JSON.stringify({ objects: ["lamp"] }),
					},
				],
			});
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent, engine } = setup(mockModel);

			let completed = "";
			await agent.run("take the brass lamp. south", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).toHaveBeenCalledTimes(1);
			expect(completed).toContain("Taken.");
			expect(completed).toContain("Room B");
			expect(engine.save().state.objects.lamp.location).toBe("inventory");
			expect(engine.save().state.player.current_room).toBe("room_b");
		});

		it("halts execution immediately when an error or blocked action occurs", async () => {
			const doGenerate = vi.fn().mockResolvedValue({
				rawCall: { rawPrompt: null, rawSettings: {} },
				finishReason: "tool-calls",
				usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
				content: [
					{
						type: "tool-call",
						toolCallId: "call_take",
						toolName: "take",
						input: JSON.stringify({ objects: ["lamp"] }),
					},
				],
			});
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent, engine } = setup(mockModel);

			// In room_a, there is no west exit. Command 1 fails -> Command 2 (take lamp) must NOT run
			let completed = "";
			await agent.run("west. take the brass lamp", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(completed).toBe("You can't go that way.");
			// LLM should not even be called for command 2
			expect(doGenerate).not.toHaveBeenCalled();
			expect(engine.save().state.objects.lamp.location).toBe("room_a");
		});

		it("halts execution immediately when player dies", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent, engine } = setup(mockModel);

			let completed = "";
			await agent.run("look. die. wait", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(completed).toContain("Room A");
			expect(completed).toContain("You died!");
			expect(completed).not.toContain("Time passes...");
			expect(engine.isPlayerDead()).toBe(true);
		});

		it("handles single command with trailing period correctly", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const { agent } = setup(mockModel);

			let completed = "";
			await agent.run("look.", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("Room A");
		});

		it("persists command history across multi-command runs and reconstructs game state", async () => {
			const doGenerate = vi.fn().mockResolvedValue({
				rawCall: { rawPrompt: null, rawSettings: {} },
				finishReason: "tool-calls",
				usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
				content: [
					{
						type: "tool-call",
						toolCallId: "call_history_take",
						toolName: "take",
						input: JSON.stringify({ objects: ["lamp"] }),
					},
				],
			});
			const mockModel = new MockLanguageModelV3({ doGenerate });
			const world = makeTestWorld();
			const engine = new GameEngine(world);
			engine.start();
			const agent = new GameAgent(mockModel, engine, mockModel);

			await agent.run("take the brass lantern. south", [], {
				onToken: () => {},
				onComplete: () => {},
			});

			const history = engine.getCommandHistory();
			expect(history).toHaveLength(2);

			expect(history[0].input).toBe("take the brass lantern");
			expect(history[0].output).toBe("Taken.");
			expect(history[0].tool_calls).toHaveLength(1);
			expect(history[0].state?.objects.lamp.location).toBe("inventory");

			expect(history[1].input).toBe("south");
			expect(history[1].output).toContain("Room B");
			expect(history[1].state?.player.current_room).toBe("room_b");

			const saveFile = engine.save();
			expect(saveFile.history).toHaveLength(2);

			// Recreate game state from history
			const reconstructed = recreateStateFromHistory(world, history);
			expect(reconstructed).toEqual(engine.getState());
			expect(reconstructed.objects.lamp.location).toBe("inventory");
			expect(reconstructed.player.current_room).toBe("room_b");
		});
	});

	describe("verb frame assumptions integration", () => {
		function makeWorldWith(customObjects: Record<string, GameObject>) {
			const base = makeTestWorld();
			return {
				...base,
				objects: {
					...base.objects,
					...customObjects,
				},
			};
		}

		it("fast-path executes attack command with assumed enemy and weapon defaults", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });

			const world = makeWorldWith({
				troll: {
					id: "troll",
					name: "nasty troll",
					aliases: ["troll"],
					type: "actor",
					location: "room_a",
					descriptions: { default: "A nasty troll blocks your path." },
					state: { alive: true, dead: false, carriable: false },
				},
				sword: {
					id: "sword",
					name: "iron sword",
					aliases: ["sword"],
					type: "weapon",
					location: "inventory",
					descriptions: { default: "A sharp iron sword." },
					state: { carriable: true },
				},
			});

			const engine = new GameEngine(world);
			engine.start();
			const agent = new GameAgent(mockModel, engine, mockModel);

			let completed = "";
			await agent.run("attack", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			// Fast-path parser executes attack without calling the LLM
			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("(the nasty troll with the iron sword)");
			expect(completed).toContain("Attacking the nasty troll has no effect.");
		});

		it("fast-path executes unlock command assuming locked door and matching key", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });

			const base = makeTestWorld();
			const world = {
				...base,
				objects: {
					...base.objects,
					// Unlock the default wooden door so cellar_door is the only locked door
					door: {
						...base.objects.door,
						state: { ...base.objects.door.state, locked: false },
					},
					cellar_door: {
						id: "cellar_door",
						name: "heavy iron door",
						aliases: ["door"],
						type: "door",
						location: "room_a",
						descriptions: { default: "A heavy locked door." },
						state: { locked: true, open: false, carriable: false },
						requires_instrument: { unlock: "rusty_key" },
					},
					rusty_key: {
						id: "rusty_key",
						name: "rusty iron key",
						aliases: ["key"],
						type: "key",
						location: "inventory",
						descriptions: { default: "A rusty key." },
						state: { carriable: true },
					},
				},
			};

			const engine = new GameEngine(world);
			engine.start();
			const agent = new GameAgent(mockModel, engine, mockModel);

			let completed = "";
			await agent.run("unlock", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("(the heavy iron door with the rusty iron key)");
			expect(engine.getState().objects.cellar_door.state.locked).toBe(false);
		});

		it("fast-path executes turn on / light assuming unambiguous lantern in inventory", async () => {
			const doGenerate = vi.fn();
			const mockModel = new MockLanguageModelV3({ doGenerate });

			const world = makeWorldWith({
				brass_lantern: {
					id: "brass_lantern",
					name: "brass lantern",
					aliases: ["lantern"],
					type: "item",
					location: "inventory",
					descriptions: { default: "A shiny brass lantern." },
					state: { lit: false, carriable: true },
				},
			});

			const engine = new GameEngine(world);
			engine.start();
			const agent = new GameAgent(mockModel, engine, mockModel);

			let completed = "";
			await agent.run("light", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).not.toHaveBeenCalled();
			expect(completed).toContain("(the brass lantern)");
			expect(completed).toContain("The brass lantern is now on.");
			expect(engine.getState().objects.brass_lantern.state.lit).toBe(true);
		});

		it("populates weapon assumption when LLM tool call has missing weapon parameter", async () => {
			const doGenerate = vi.fn().mockResolvedValue({
				rawCall: { rawPrompt: null, rawSettings: {} },
				finishReason: "tool-calls",
				usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
				content: [
					{
						type: "tool-call",
						toolCallId: "call_attack_1",
						toolName: "attack",
						input: JSON.stringify({ objects: ["troll"] }),
					},
				],
			});
			const mockModel = new MockLanguageModelV3({ doGenerate });

			const world = makeWorldWith({
				troll: {
					id: "troll",
					name: "nasty troll",
					aliases: ["troll"],
					type: "actor",
					location: "room_a",
					descriptions: { default: "A troll." },
					state: { alive: true, dead: false, carriable: false },
				},
				sword: {
					id: "sword",
					name: "iron sword",
					aliases: ["sword"],
					type: "weapon",
					location: "inventory",
					descriptions: { default: "A sword." },
					state: { carriable: true },
				},
			});

			const engine = new GameEngine(world);
			engine.start();
			const agent = new GameAgent(mockModel, engine, mockModel);

			let completed = "";
			await agent.run("furious assault against the troll!", [], {
				onToken: () => {},
				onComplete: (c) => {
					completed = c;
				},
			});

			expect(doGenerate).toHaveBeenCalled();
			expect(completed).toContain("(with the iron sword)");
			expect(completed).toContain("Attacking the nasty troll has no effect.");
		});
	});
});
