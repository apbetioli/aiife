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

	it("handles schema-only actions without a handler", () => {
		const { bus, registry } = setup();

		const cleanup = registerAction(bus, registry, "custom_schema_only", {
			schema: z.object({ test: z.string() }),
			description: "custom(): Custom action.",
		});

		expect(registry.has("custom_schema_only")).toBe(true);
		cleanup();
		expect(registry.has("custom_schema_only")).toBe(false);
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
		expect(engine.state.player.state.blessed).toBe(true);
	});
});
