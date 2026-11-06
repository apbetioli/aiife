import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTestWorld } from "../engine/__fixtures__/test-world";
import { defineGame } from "./define-game";
import { WorldSchema } from "./types";
import { normalizeGameExport } from "./world-loader";

describe("defineGame", () => {
	it("wraps world and setup into a GameDefinition", () => {
		const world = makeTestWorld();
		const setup = () => {};
		const game = defineGame({ world, setup });

		expect(game.world).toBe(world);
		expect(game.setup).toBe(setup);
	});

	it("accepts a bare World object and produces GameDefinition without setup", () => {
		const world = makeTestWorld();
		const game = defineGame(world);

		expect(game.world).toBe(world);
		expect(game.setup).toBeUndefined();
	});
});

describe("normalizeGameExport (polymorphic loader)", () => {
	it("loads bundled GameDefinition from default export (defineGame pattern)", () => {
		const world = makeTestWorld();
		const setup = () => {};
		const mod = {
			default: defineGame({ world, setup }),
		};

		const result = normalizeGameExport(mod);
		expect(result.world.id).toBe(world.id);
		expect(result.setup).toBe(setup);
	});

	it("loads bare world default export with separate named setup export (legacy pattern)", () => {
		const world = makeTestWorld();
		const setup = () => {};
		const mod = {
			default: world,
			setup,
		};

		const result = normalizeGameExport(mod);
		expect(result.world.id).toBe(world.id);
		expect(result.setup).toBe(setup);
	});

	it("loads bare world default export without any setup", () => {
		const world = makeTestWorld();
		const mod = {
			default: world,
		};

		const result = normalizeGameExport(mod);
		expect(result.world.id).toBe(world.id);
		expect(result.setup).toBeUndefined();
	});

	it("throws if export is invalid", () => {
		expect(() => normalizeGameExport(null)).toThrow("Game module must export an object");
		expect(() => normalizeGameExport(undefined)).toThrow("Game module must export an object");
		expect(() => normalizeGameExport({ default: { invalid: true } })).toThrow();
	});
});

describe("JSON world loading", () => {
	it("validates that games/the-forgotten-manor.json is a valid standalone JSON world definition", async () => {
		const raw = await readFile(resolve(import.meta.dirname, "../../games/the-forgotten-manor.json"), "utf-8");
		const world = WorldSchema.parse(JSON.parse(raw));
		expect(world.id).toBe("forgotten_manor");
		expect(world.start_room).toBe("entrance_hall");
		expect(Object.keys(world.rooms)).toHaveLength(4);
	});
});
