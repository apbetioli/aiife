import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeTestWorld } from "../__fixtures__/test-world";
import { GameEngine } from "../game-engine";
import { buildInitialState } from "../initial-state";
import { ActionRegistry } from "./action-registry";
import { objectsSchema } from "./core-actions/schemas";
import { EventBus } from "./event-bus";
import { executeUntrustedAction } from "./executor";
import { PRIORITY } from "./priorities";
import { registerAction } from "./register-action";

describe("registerAction", () => {
	function setup() {
		const bus = new EventBus();
		const registry = new ActionRegistry();
		const world = makeTestWorld();
		const state = buildInitialState(world);
		return { bus, registry, world, state };
	}

	it("registers action in ActionRegistry and EventBus", () => {
		const { bus, registry, world, state } = setup();

		registerAction(bus, registry, "pray", {
			schema: objectsSchema,
			description: "pray(objects?): Pray to a deity or at a shrine.",
			aliases: ["worship", "kneel"],
			hint: "Use pray when worshiping",
			handler: (_event, _state, _world) => "You whisper a prayer into the stillness.",
		});

		// Verified in ActionRegistry
		expect(registry.has("pray")).toBe(true);
		expect(registry.getDescriptions().pray).toBe("pray(objects?): Pray to a deity or at a shrine.");
		const meta = registry.getIntentMeta().pray;
		expect(meta.description).toBe("pray(objects?): Pray to a deity or at a shrine.");
		expect(meta.aliases).toEqual(["worship", "kneel"]);
		expect(meta.hint).toBe("Use pray when worshiping");

		// Verified via execution
		const result = executeUntrustedAction(bus, registry, world, state, "pray", { objects: [] });
		expect(result.stopped).toBe(false);
		expect(result.feedback).toEqual(["You whisper a prayer into the stillness."]);
	});

	it("passes state, world, and bus to the handler and mutates state", () => {
		const { bus, registry, world, state } = setup();

		registerAction(bus, registry, "bless", {
			schema: objectsSchema,
			description: "bless(objects): Bless an object.",
			handler: (event, s, _world) => {
				const target = event.params.objects?.[0];
				if (target && s.objects[target]) {
					s.objects[target].state.blessed = true;
					return `The ${target} glows with divine light.`;
				}
				return "Nothing happened.";
			},
		});

		const result = executeUntrustedAction(bus, registry, world, state, "bless", { objects: ["lamp"] });
		expect(result.feedback).toEqual(["The lamp glows with divine light."]);
		expect(result.state.objects.lamp.state.blessed).toBe(true);
	});

	it("can stop the event and return cancellation feedback", () => {
		const { bus, registry, world, state } = setup();

		registerAction(bus, registry, "shout", {
			schema: z.object({}),
			description: "shout(): Shout loudly.",
			handler: (event) => {
				event.stop();
				return "Your voice fails you.";
			},
		});

		const result = executeUntrustedAction(bus, registry, world, state, "shout", {});
		expect(result.stopped).toBe(true);
		expect(result.feedback).toEqual(["Your voice fails you."]);
	});

	it("respects custom priority when provided", () => {
		const { bus, registry, world, state } = setup();
		const order: string[] = [];

		registerAction(bus, registry, "dance", {
			schema: z.object({}),
			description: "dance(): Dance joyfully.",
			priority: PRIORITY.GUARD,
			handler: () => {
				order.push("guard");
			},
		});

		bus.on(
			"dance",
			() => {
				order.push("mutation");
			},
			{ priority: PRIORITY.MUTATION },
		);

		executeUntrustedAction(bus, registry, world, state, "dance", {});
		expect(order).toEqual(["guard", "mutation"]);
	});

	it("registers action with minimal handler", () => {
		const { bus, registry } = setup();

		const cleanup = registerAction(bus, registry, "custom_action", {
			schema: z.object({ test: z.string() }),
			description: "custom(): Custom action.",
			handler: () => undefined,
		});

		expect(registry.has("custom_action")).toBe(true);
		cleanup();
		expect(registry.has("custom_action")).toBe(false);
	});

	it("cleanup unregisters the action from both ActionRegistry and EventBus", () => {
		const { bus, registry, world, state } = setup();

		const cleanup = registerAction(bus, registry, "jump", {
			schema: z.object({}),
			description: "jump(): Jump in place.",
			handler: () => "You jump!",
		});

		expect(registry.has("jump")).toBe(true);
		const resultBefore = executeUntrustedAction(bus, registry, world, state, "jump", {});
		expect(resultBefore.feedback).toEqual(["You jump!"]);

		// Unregister
		cleanup();

		expect(registry.has("jump")).toBe(false);
		const resultAfter = executeUntrustedAction(bus, registry, world, state, "jump", {});
		// Should fail schema validation since action is unknown
		expect(resultAfter.stopped).toBe(true);
		expect(resultAfter.feedback[0]).toContain("Unknown action: jump");
	});

	it("integrates seamlessly with GameEngine via setup", () => {
		const world = makeTestWorld();

		const engine = new GameEngine(world, (bus, registry) => {
			registerAction(bus, registry, "pray", {
				schema: z.object({ objects: z.array(z.string()).optional() }),
				description: "pray(objects?): Pray at a shrine or altar.",
				aliases: ["worship"],
				handler: (_event, s) => {
					s.player.state.blessed = true;
					return "A peaceful warmth settles in your chest.";
				},
			});
		});

		// Verified in intent metadata (which the LLM agent prompt consumes)
		const meta = engine.getIntentMeta();
		expect(meta.pray).toBeDefined();
		expect(meta.pray.description).toBe("pray(objects?): Pray at a shrine or altar.");
		expect(meta.pray.aliases).toEqual(["worship"]);

		// Verified in runAction execution
		const feedback = engine.runAction({
			action: "pray",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});

		expect(feedback).toBe("A peaceful warmth settles in your chest.");
		expect(engine.save().state.player.state.blessed).toBe(true);
	});

	it("does not advance tick or moves when action is stopped", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, (bus) => {
			bus.on(
				"open",
				"door",
				(event) => {
					event.stop();
					return "The door is jammed shut.";
				},
				{ priority: 50 },
			);
		});

		const movesBefore = (engine.save().state.player.state.moves as number) ?? 0;
		const feedback = engine.runAction({
			action: "open",
			direction: null,
			objects: ["door"],
			preposition: null,
			message: null,
		});

		expect(feedback).toBe("The door is jammed shut.");
		const movesAfter = (engine.save().state.player.state.moves as number) ?? 0;
		expect(movesAfter).toBe(movesBefore);
	});

	it("executes undo via runAction to roll back moves", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({
			action: "go",
			direction: "south",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(engine.save().state.player.current_room).toBe("room_b");

		const undoFeedback = engine.runAction({
			action: "undo",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(undoFeedback).toContain("Room A");
		expect(engine.save().state.player.current_room).toBe("room_a");
	});

	it("executes save and restore via runAction to persist state to disk", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({
			action: "go",
			direction: "south",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(engine.save().state.player.current_room).toBe("room_b");

		const saveFeedback = engine.runAction({
			action: "save",
			slot: "testslot",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(saveFeedback).toContain('Game saved to slot "testslot".');

		// Move to room_c
		engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});

		const restoreFeedback = engine.runAction({
			action: "restore",
			slot: "testslot",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(restoreFeedback).toContain("Game restored.");
		expect(engine.save().state.player.current_room).toBe("room_b");
	});

	it("supports modern AI SDK tool style: inputSchema and execute", () => {
		const { bus, registry, world, state } = setup();

		registerAction(bus, registry, "heal", {
			description: "heal(amount): Heal player by an amount.",
			inputSchema: z.object({ amount: z.number() }),
			execute: ({ amount }, { state: s }) => {
				s.player.state.health = ((s.player.state.health as number) ?? 10) + amount;
				return `Healed for ${amount}.`;
			},
		});

		expect(registry.has("heal")).toBe(true);
		expect(registry.get("heal")?.inputSchema).toBeDefined();

		const result = executeUntrustedAction(bus, registry, world, state, "heal", { amount: 5 });
		expect(result.stopped).toBe(false);
		expect(result.feedback).toEqual(["Healed for 5."]);
		expect(result.state.player.state.health).toBe(15);
	});

	it("can stop action using context.stop() in execute", () => {
		const { bus, registry, world, state } = setup();

		registerAction(bus, registry, "curse", {
			description: "curse(): Cast a forbidden curse.",
			inputSchema: z.object({}),
			execute: (_params, { stop }) => {
				stop();
				return "A protective aura prevents the curse.";
			},
		});

		const result = executeUntrustedAction(bus, registry, world, state, "curse", {});
		expect(result.stopped).toBe(true);
		expect(result.feedback).toEqual(["A protective aura prevents the curse."]);
	});

	it("filters active actions via ActionRegistry.getActiveActions and scope rules", () => {
		const { bus, registry, state } = setup();
		const context = {
			room: "room_a",
			description: "A plain test room.",
			available_exits: ["south" as const],
			in_scope_objects: [
				{
					id: "lamp",
					name: "brass lamp",
					aliases: [],
					type: "item" as const,
					state: {},
					source: "room" as const,
				},
			],
		};

		// 1. Global action (default)
		registerAction(bus, registry, "score", {
			inputSchema: z.object({}),
			description: "score(): Show score.",
			execute: () => "0 points",
		});

		// 2. Action scoped by room (not in room_b, so inactive)
		registerAction(bus, registry, "echo", {
			inputSchema: z.object({}),
			description: "echo(): Echo in room_b.",
			scope: { rooms: ["room_b"] },
			execute: () => "Echo!",
		});

		// 3. Action scoped by object (lamp is in scope, so active)
		registerAction(bus, registry, "turn_on", {
			inputSchema: z.object({}),
			description: "turn_on(): Turn on light.",
			scope: { objects: ["lamp"] },
			execute: () => "Lit.",
		});

		// 4. Action scoped by object type (actor not in scope, so inactive)
		registerAction(bus, registry, "talk", {
			inputSchema: z.object({}),
			description: "talk(): Talk to actor.",
			scope: { types: ["actor"] },
			execute: () => "Hello.",
		});

		// 5. Action scoped by dynamic predicate
		registerAction(bus, registry, "custom_predicate", {
			inputSchema: z.object({}),
			description: "custom(): Custom predicate.",
			scope: (ctx) => ctx.available_exits.length > 0,
			execute: () => "Ok",
		});

		const active = registry.getActiveActions(context, state);
		expect(active).toContain("score");
		expect(active).toContain("turn_on");
		expect(active).toContain("custom_predicate");
		expect(active).not.toContain("echo");
		expect(active).not.toContain("talk");
	});

	it("exposes getActiveActions on GameEngine", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, (bus, registry) => {
			registerAction(bus, registry, "special", {
				inputSchema: z.object({}),
				description: "special(): Special action in room_a.",
				scope: { rooms: ["room_a"] },
				execute: () => "Special!",
			});
		});

		expect(engine.getActiveActions()).toContain("special");
	});
});
