import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeTestWorld } from "./__fixtures__/test-world";
import { GameEngine } from "./game-engine";
import type { ActionEntry } from "./rules/action-registry";
import { navigationActions } from "./rules/core-actions";
import type { ActionDef } from "./rules/types";

describe("GameEngine Action Configuration and Composable Packs", () => {
	it("registers all standard adventure actions by default when options are omitted", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		const registry = engine.getActionRegistry();

		expect(registry.has("go")).toBe(true);
		expect(registry.has("take")).toBe(true);
		expect(registry.has("look")).toBe(true);
		expect(registry.has("inventory")).toBe(true);
		expect(registry.has("undo")).toBe(true);
		expect(registry.has("wait")).toBe(true);
		expect(registry.has("again")).toBe(true);
		expect(registry.has("save")).toBe(true);
		expect(registry.has("restore")).toBe(true);
	});

	it("registers no default actions when actions is an empty array", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { actions: [] });
		const registry = engine.getActionRegistry();

		expect(registry.names()).toHaveLength(0);
		expect(registry.has("go")).toBe(false);
		expect(registry.has("look")).toBe(false);
		expect(registry.has("undo")).toBe(false);
		expect(registry.has("save")).toBe(false);

		// start() succeeds gracefully without executing missing look or game:start
		const startFeedback = engine.start();
		expect(startFeedback).toBe("");

		// Unregistered actions return fallback message
		expect(engine.runAction({ action: "go", direction: "north" })).toBe("I don't understand that.");
		expect(engine.runAction({ action: "undo" })).toBe("I don't understand that.");
		expect(engine.runAction({ action: "save" })).toBe("I don't understand that.");
		expect(engine.runAction({ action: "restore" })).toBe("I don't understand that.");
	});

	it("allows composing specific packs (e.g. only navigation)", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { actions: [navigationActions] });
		const registry = engine.getActionRegistry();

		expect(registry.has("go")).toBe(true);
		expect(registry.has("enter")).toBe(true);
		expect(registry.has("exit")).toBe(true);

		expect(registry.has("take")).toBe(false);
		expect(registry.has("drop")).toBe(false);
		expect(registry.has("attack")).toBe(false);
		expect(registry.has("look")).toBe(false);
	});

	it("supports custom action pack definitions and packs combined with presets", () => {
		const world = makeTestWorld();

		const pingAction: ActionDef = {
			description: "ping(): Send a network ping. No parameters.",
			inputSchema: z.object({}),
			execute: () => "pong!",
		};

		const terminalPack = {
			ping: pingAction,
		};

		const engine = new GameEngine(world, {
			actions: [navigationActions, terminalPack],
		});
		const registry = engine.getActionRegistry();

		expect(registry.has("go")).toBe(true);
		expect(registry.has("ping")).toBe(true);
		expect(registry.has("take")).toBe(false);

		const feedback = engine.runAction({ action: "ping" });
		expect(feedback).toBe("pong!");
	});

	it("supports function-based ActionPack", () => {
		const world = makeTestWorld();

		const customPack = (_bus: unknown, registry: { register: (name: string, entry: ActionEntry) => void }) => {
			registry.register("test_verb", {
				description: "test",
				inputSchema: z.object({}),
			});
		};

		const engine = new GameEngine(world, { actions: [customPack] });
		expect(engine.getActionRegistry().has("test_verb")).toBe(true);
		expect(engine.getActionRegistry().has("go")).toBe(false);
	});

	it("runs custom game:start lifecycle without requiring look", () => {
		const world = makeTestWorld();

		const customStart: ActionDef = {
			description: "Custom game start",
			inputSchema: z.object({}),
			execute: () => "Welcome to the terminal simulator.",
		};

		const engine = new GameEngine(world, {
			actions: [{ "game:start": customStart }],
		});

		const feedback = engine.start();
		expect(feedback).toBe("Welcome to the terminal simulator.");
	});

	it("replays previous command with again", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		// No previous command initially
		expect(engine.runAction({ action: "again" })).toBe("There is no previous command to repeat.");

		// Run wait command
		const waitOutput = engine.runAction({ action: "wait" });
		expect(waitOutput).toBe("Time passes...");

		// Repeating again replays wait
		const repeatOutput = engine.runAction({ action: "again" });
		expect(repeatOutput).toBe("Time passes...");
	});
});
