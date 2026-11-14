import { describe, expect, it } from "vitest";
import { makeTestWorld } from "../engine/__fixtures__/test-world";
import { buildInitialState } from "../engine/initial-state";
import type { GameObject } from "../world/types";
import { formatAssumptionAnnouncement, resolveEntityId, resolveVerbFrameAssumptions } from "./verb-frames";

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

describe("verb-frames assumptions", () => {
	it("resolveEntityId finds objects by exact ID, lowercase name, and aliases", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(resolveEntityId("lamp", world, state)).toBe("lamp");
		expect(resolveEntityId("brass lamp", world, state)).toBe("lamp");
		expect(resolveEntityId("wooden door", world, state)).toBe("door");
		expect(resolveEntityId("nonexistent", world, state)).toBeUndefined();
	});

	it("formatAssumptionAnnouncement formats target, instrument, and combined parentheticals", () => {
		expect(
			formatAssumptionAnnouncement([
				{ slot: "target", objectId: "troll", objectName: "troll" },
				{ slot: "instrument", objectId: "elvish_sword", objectName: "elvish sword" },
			]),
		).toBe("(the troll with the elvish sword)");

		expect(
			formatAssumptionAnnouncement([{ slot: "instrument", objectId: "elvish_sword", objectName: "the elvish sword" }]),
		).toBe("(with the elvish sword)");

		expect(
			formatAssumptionAnnouncement([{ slot: "target", objectId: "brass_lantern", objectName: "brass lantern" }]),
		).toBe("(the brass lantern)");

		expect(formatAssumptionAnnouncement([])).toBeNull();
	});

	describe("attack verb frame assumptions", () => {
		it("populates both target and weapon when unambiguous enemy in room and weapon in inventory", () => {
			const world = makeWorldWith({
				goblin: {
					id: "goblin",
					name: "foul goblin",
					aliases: ["goblin"],
					type: "actor",
					location: "room_a",
					descriptions: { default: "A snarling goblin." },
					state: { alive: true, dead: false, carriable: false },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack" }, world, state);

			expect(result.assumptions).toHaveLength(2);
			expect(result.assumptions[0]).toEqual({
				slot: "target",
				objectId: "goblin",
				objectName: "foul goblin",
			});
			expect(result.assumptions[1]).toEqual({
				slot: "instrument",
				objectId: "sword",
				objectName: "iron sword",
			});
			expect(result.announcement).toBe("(the foul goblin with the iron sword)");
			expect(result.intent.objects).toEqual(["goblin", "sword"]);
		});

		it("populates weapon only when target is already provided (e.g. attack goblin)", () => {
			const world = makeWorldWith({
				goblin: {
					id: "goblin",
					name: "foul goblin",
					aliases: ["goblin"],
					type: "actor",
					location: "room_a",
					descriptions: { default: "A snarling goblin." },
					state: { alive: true, dead: false, carriable: false },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack", objects: ["goblin"] }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0]).toEqual({
				slot: "instrument",
				objectId: "sword",
				objectName: "iron sword",
			});
			expect(result.announcement).toBe("(with the iron sword)");
			expect(result.intent.objects).toEqual(["goblin", "sword"]);
		});

		it("makes no target assumption when 0 enemies exist in current room", () => {
			const world = makeTestWorld();
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack" }, world, state);

			// Weapon is in inventory, but 0 enemies in room_a
			expect(result.assumptions.find((a) => a.slot === "target")).toBeUndefined();
			expect(result.assumptions.find((a) => a.slot === "instrument")?.objectId).toBe("sword");
			expect(result.announcement).toBe("(with the iron sword)");
		});

		it("makes no target assumption when multiple enemies are in the room (ambiguous)", () => {
			const world = makeWorldWith({
				goblin_1: {
					id: "goblin_1",
					name: "first goblin",
					aliases: [],
					type: "actor",
					location: "room_a",
					descriptions: { default: "Goblin 1." },
					state: { alive: true, dead: false, carriable: false },
				},
				goblin_2: {
					id: "goblin_2",
					name: "second goblin",
					aliases: [],
					type: "actor",
					location: "room_a",
					descriptions: { default: "Goblin 2." },
					state: { alive: true, dead: false, carriable: false },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack" }, world, state);

			expect(result.assumptions.find((a) => a.slot === "target")).toBeUndefined();
			expect(result.announcement).toBe("(with the iron sword)");
		});

		it("ignores dead enemies when finding target candidates", () => {
			const world = makeWorldWith({
				dead_goblin: {
					id: "dead_goblin",
					name: "dead goblin",
					aliases: [],
					type: "actor",
					location: "room_a",
					descriptions: { default: "Dead goblin." },
					state: { alive: false, dead: true, carriable: false },
				},
				live_orc: {
					id: "live_orc",
					name: "roaring orc",
					aliases: [],
					type: "actor",
					location: "room_a",
					descriptions: { default: "An orc." },
					state: { alive: true, dead: false, carriable: false },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack" }, world, state);

			expect(result.assumptions.find((a) => a.slot === "target")?.objectId).toBe("live_orc");
		});

		it("makes no weapon assumption when multiple weapons are in inventory (ambiguous)", () => {
			const world = makeWorldWith({
				goblin: {
					id: "goblin",
					name: "foul goblin",
					aliases: [],
					type: "actor",
					location: "room_a",
					descriptions: { default: "A goblin." },
					state: { alive: true, dead: false, carriable: false },
				},
				dagger: {
					id: "dagger",
					name: "silver dagger",
					aliases: [],
					type: "weapon",
					location: "inventory",
					descriptions: { default: "A dagger." },
					state: { carriable: true },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "attack", objects: ["goblin"] }, world, state);

			expect(result.assumptions).toHaveLength(0);
			expect(result.announcement).toBeNull();
			expect(result.intent.objects).toEqual(["goblin"]);
		});
	});

	describe("unlock verb frame assumptions", () => {
		it("assumes both locked door and required key when unambiguous in scope", () => {
			const world = makeWorldWith({
				cellar_door: {
					id: "cellar_door",
					name: "cellar door",
					aliases: [],
					type: "door",
					location: "room_a",
					descriptions: { default: "A locked cellar door." },
					state: { locked: true, open: false, carriable: false },
					requires_instrument: { unlock: "rusty_key" },
				},
				rusty_key: {
					id: "rusty_key",
					name: "rusty iron key",
					aliases: [],
					type: "key",
					location: "inventory",
					descriptions: { default: "A rusty key." },
					state: { carriable: true },
				},
			});
			// Unlock the default door so cellar_door is the only locked door
			const state = buildInitialState(world);
			state.objects.door.state.locked = false;

			const result = resolveVerbFrameAssumptions({ action: "unlock" }, world, state);

			expect(result.assumptions).toHaveLength(2);
			expect(result.assumptions[0]).toEqual({
				slot: "target",
				objectId: "cellar_door",
				objectName: "cellar door",
			});
			expect(result.assumptions[1]).toEqual({
				slot: "instrument",
				objectId: "rusty_key",
				objectName: "rusty iron key",
			});
			expect(result.announcement).toBe("(the cellar door with the rusty iron key)");
			expect(result.intent.objects).toEqual(["cellar_door", "rusty_key"]);
		});

		it("assumes key when target door is specified", () => {
			const world = makeWorldWith({
				rusty_key: {
					id: "rusty_key",
					name: "rusty iron key",
					aliases: [],
					type: "key",
					location: "inventory",
					descriptions: { default: "A rusty key." },
					state: { carriable: true },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "unlock", objects: ["door"] }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0]).toEqual({
				slot: "instrument",
				objectId: "rusty_key",
				objectName: "rusty iron key",
			});
			expect(result.announcement).toBe("(with the rusty iron key)");
			expect(result.intent.objects).toEqual(["door", "rusty_key"]);
		});

		it("does not assume already unlocked doors", () => {
			const world = makeWorldWith({
				key: {
					id: "key",
					name: "key",
					aliases: [],
					type: "key",
					location: "inventory",
					descriptions: { default: "A key." },
					state: { carriable: true },
				},
			});
			const state = buildInitialState(world);
			state.objects.door.state.locked = false;

			const result = resolveVerbFrameAssumptions({ action: "unlock" }, world, state);

			expect(result.assumptions.find((a) => a.slot === "target")).toBeUndefined();
		});
	});

	describe("turn_on and turn_off verb frame assumptions", () => {
		it("assumes unlit lantern in inventory on turn_on / light", () => {
			const world = makeWorldWith({
				lantern: {
					id: "lantern",
					name: "brass lantern",
					aliases: [],
					type: "item",
					location: "inventory",
					descriptions: { default: "A lantern." },
					state: { lit: false, carriable: true },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "turn_on" }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0]).toEqual({
				slot: "target",
				objectId: "lantern",
				objectName: "brass lantern",
			});
			expect(result.announcement).toBe("(the brass lantern)");
			expect(result.intent.objects).toEqual(["lantern"]);
		});

		it("assumes lit lantern on turn_off / extinguish", () => {
			const world = makeWorldWith({
				lantern: {
					id: "lantern",
					name: "brass lantern",
					aliases: [],
					type: "item",
					location: "inventory",
					descriptions: { default: "A lantern." },
					state: { lit: true, carriable: true },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "turn_off" }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0].objectId).toBe("lantern");
			expect(result.announcement).toBe("(the brass lantern)");
			expect(result.intent.objects).toEqual(["lantern"]);
		});

		it("does not assume light source when multiple unlit light sources exist in inventory (ambiguous)", () => {
			const world = makeWorldWith({
				lantern: {
					id: "lantern",
					name: "brass lantern",
					aliases: [],
					type: "item",
					location: "inventory",
					descriptions: { default: "A lantern." },
					state: { lit: false, carriable: true },
				},
				candles: {
					id: "candles",
					name: "wax candles",
					aliases: [],
					type: "item",
					location: "inventory",
					descriptions: { default: "Candles." },
					state: { lit: false, carriable: true },
				},
			});
			const state = buildInitialState(world);

			const result = resolveVerbFrameAssumptions({ action: "turn_on" }, world, state);

			expect(result.assumptions).toHaveLength(0);
			expect(result.announcement).toBeNull();
		});
	});

	describe("open and close verb frame assumptions", () => {
		it("assumes unambiguous closed container on open", () => {
			const world = makeTestWorld();
			const state = buildInitialState(world);
			// In makeTestWorld, chest is closed and door is closed (2 closed objects).
			// If door is open, chest is the only closed object:
			state.objects.door.state.open = true;

			const result = resolveVerbFrameAssumptions({ action: "open" }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0].objectId).toBe("chest");
			expect(result.announcement).toBe("(the wooden chest)");
		});

		it("assumes unambiguous open container on close", () => {
			const world = makeTestWorld();
			const state = buildInitialState(world);
			// Open chest so it's the only open container/door
			state.objects.chest.state.open = true;

			const result = resolveVerbFrameAssumptions({ action: "close" }, world, state);

			expect(result.assumptions).toHaveLength(1);
			expect(result.assumptions[0].objectId).toBe("chest");
			expect(result.announcement).toBe("(the wooden chest)");
		});
	});
});
