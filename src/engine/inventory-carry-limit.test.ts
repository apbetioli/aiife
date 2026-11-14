import { describe, expect, it } from "vitest";
import { GameObjectSchema, PlayerSchema } from "../world/types";
import { makeTestWorld } from "./__fixtures__/test-world";
import { GameEngine } from "./game-engine";
import { buildInitialState } from "./initial-state";
import {
	getCarriedObjects,
	getCarriedWeight,
	getInventoryWeight,
	getObjectWeight,
	getPlayerCapacity,
	immutable,
	isCarried,
	setPlayerCapacity,
} from "./mutators";
import { ActionRegistry, EventBus } from "./rules";
import { registerCoreActions } from "./rules/core-actions";
import { executeAction } from "./rules/executor";

function setup(overrides?: Parameters<typeof makeTestWorld>[0]) {
	const world = makeTestWorld(overrides);
	const bus = new EventBus();
	const registry = new ActionRegistry();
	registerCoreActions(bus, registry);
	const state = buildInitialState(world);
	return { world, bus, registry, state };
}

describe("Inventory Carry Limit & Weight System", () => {
	describe("Schema & Defaults", () => {
		it("defaults object weight to 1 when omitted in GameObjectSchema", () => {
			const parsed = GameObjectSchema.parse({
				id: "apple",
				name: "apple",
				type: "item",
				location: "room_a",
				descriptions: { default: "A crisp red apple." },
			});
			expect(parsed.weight).toBe(1);
		});

		it("preserves explicit object weight in GameObjectSchema", () => {
			const parsed = GameObjectSchema.parse({
				id: "boulder",
				name: "boulder",
				type: "item",
				location: "room_a",
				weight: 5,
				descriptions: { default: "A heavy granite boulder." },
			});
			expect(parsed.weight).toBe(5);
		});

		it("allows 0 weight in GameObjectSchema", () => {
			const parsed = GameObjectSchema.parse({
				id: "feather",
				name: "feather",
				type: "item",
				location: "room_a",
				weight: 0,
				descriptions: { default: "A light white feather." },
			});
			expect(parsed.weight).toBe(0);
		});

		it("defaults player capacity to 7 when omitted in PlayerSchema", () => {
			const parsed = PlayerSchema.parse({
				current_room: "room_a",
			});
			expect(parsed.capacity).toBe(7);
		});

		it("preserves explicit player capacity in PlayerSchema", () => {
			const parsed = PlayerSchema.parse({
				current_room: "room_a",
				capacity: 12,
			});
			expect(parsed.capacity).toBe(12);
		});

		it("buildInitialState assigns default capacity of 7 to player state", () => {
			const { state } = setup();
			expect(state.player.capacity).toBe(7);
			expect(getPlayerCapacity(state)).toBe(7);
		});

		it("buildInitialState respects player capacity configured on player", () => {
			const { state } = setup({
				player: {
					current_room: "room_a",
					capacity: 15,
					state: {},
				},
			});
			expect(state.player.capacity).toBe(15);
			expect(getPlayerCapacity(state)).toBe(15);
		});

		it("buildInitialState respects capacity configured at world level", () => {
			const { state } = setup({
				capacity: 10,
				player: {
					current_room: "room_a",
					state: {},
				},
			});
			expect(state.player.capacity).toBe(10);
			expect(getPlayerCapacity(state)).toBe(10);
		});
	});

	describe("Weight and Capacity Mutators", () => {
		it("getObjectWeight returns world weight, dynamic state weight, or default 1", () => {
			const { world, state } = setup({
				objects: {
					...makeTestWorld().objects,
					heavy_rock: {
						id: "heavy_rock",
						name: "heavy rock",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 4,
						state: {},
						descriptions: { default: "A heavy rock." },
					},
					feather: {
						id: "feather",
						name: "feather",
						aliases: [],
						type: "item",
						location: "room_a",
						state: {},
						descriptions: { default: "A feather." },
					},
				},
			});

			expect(getObjectWeight(world, "heavy_rock", state)).toBe(4);
			expect(getObjectWeight(world, "feather", state)).toBe(1);

			// Dynamic state override
			const mutated = immutable(state, (s) => {
				s.objects.heavy_rock.state.weight = 10;
			});
			expect(getObjectWeight(world, "heavy_rock", mutated)).toBe(10);
		});

		it("isCarried and getCarriedWeight correctly calculate direct and container weights", () => {
			const { world, state } = setup({
				objects: {
					...makeTestWorld().objects,
					bag: {
						id: "bag",
						name: "leather bag",
						aliases: [],
						type: "container",
						location: "inventory",
						weight: 1,
						state: { open: true, carriable: true },
						descriptions: { default: "A small leather bag." },
					},
					coin: {
						id: "coin",
						name: "gold coin",
						aliases: [],
						type: "item",
						location: "bag",
						weight: 2,
						state: {},
						descriptions: { default: "A gold coin." },
					},
				},
			});

			// sword (default 1) in inventory + bag (1) + coin inside bag (2) = 4
			expect(isCarried(state, "sword")).toBe(true);
			expect(isCarried(state, "bag")).toBe(true);
			expect(isCarried(state, "coin")).toBe(true);
			expect(isCarried(state, "lamp")).toBe(false);

			expect(getCarriedObjects(state)).toContain("sword");
			expect(getCarriedObjects(state)).toContain("bag");
			expect(getCarriedObjects(state)).toContain("coin");

			expect(getCarriedWeight(state, world)).toBe(4);
			expect(getInventoryWeight(state, world)).toBe(4);
		});

		it("setPlayerCapacity modifies capacity in state", () => {
			const { state } = setup();
			expect(getPlayerCapacity(state)).toBe(7);

			const updated = immutable(state, (s) => {
				setPlayerCapacity(s, 20);
			});
			expect(getPlayerCapacity(updated)).toBe(20);
		});
	});

	describe("Take Action Capacity Enforcement", () => {
		it("allows taking item when within capacity limit", () => {
			const { world, bus, state } = setup();
			// initial inventory: sword (weight 1). capacity: 7.
			// lamp weight: 1. total after take: 2 <= 7.
			const res = executeAction(bus, world, state, "take", { objects: ["lamp"] });
			expect(res.stopped).toBe(false);
			expect(res.feedback).toContain("Taken.");
			expect(res.state.objects.lamp.location).toBe("inventory");
			expect(getCarriedWeight(res.state, world)).toBe(2);
		});

		it("allows taking item up to exact capacity limit", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 3,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					dumbbell: {
						id: "dumbbell",
						name: "iron dumbbell",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 2,
						state: {},
						descriptions: { default: "A 2-unit dumbbell." },
					},
				},
			});

			// sword = 1, dumbbell = 2 -> total = 3 === capacity (3)
			const res = executeAction(bus, world, state, "take", { objects: ["dumbbell"] });
			expect(res.stopped).toBe(false);
			expect(res.feedback).toContain("Taken.");
			expect(res.state.objects.dumbbell.location).toBe("inventory");
			expect(getCarriedWeight(res.state, world)).toBe(3);
		});

		it("rejects taking single item when total weight exceeds capacity", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 2,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					anvil: {
						id: "anvil",
						name: "heavy anvil",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 2,
						state: {},
						descriptions: { default: "A heavy anvil." },
					},
				},
			});

			// sword = 1, anvil = 2 -> total = 3 > capacity (2)
			const res = executeAction(bus, world, state, "take", { objects: ["anvil"] });
			expect(res.stopped).toBe(true);
			expect(res.feedback).toContain("Your load is too heavy.");
			expect(res.state.objects.anvil.location).toBe("room_a");
			expect(getCarriedWeight(res.state, world)).toBe(1);
		});

		it("uses custom too_heavy message from object descriptions if defined", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 1,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					boulder: {
						id: "boulder",
						name: "granite boulder",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 5,
						state: {},
						descriptions: {
							default: "A massive boulder.",
							too_heavy: "That boulder is far too heavy for mortal arms.",
						},
					},
				},
			});

			const res = executeAction(bus, world, state, "take", { objects: ["boulder"] });
			expect(res.stopped).toBe(true);
			expect(res.feedback).toContain("That boulder is far too heavy for mortal arms.");
		});

		it("dropping an item reduces carried weight and allows taking previously rejected item", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 2,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					chest_key: {
						id: "chest_key",
						name: "chest key",
						aliases: [],
						type: "key",
						location: "room_a",
						weight: 2,
						state: {},
						descriptions: { default: "A heavy key." },
					},
				},
			});

			// Attempt take: sword (1) + key (2) = 3 > 2 -> fails
			const failRes = executeAction(bus, world, state, "take", { objects: ["chest_key"] });
			expect(failRes.stopped).toBe(true);
			expect(failRes.feedback).toContain("Your load is too heavy.");

			// Drop sword (frees 1 weight; carried weight becomes 0)
			const dropRes = executeAction(bus, world, failRes.state, "drop", { objects: ["sword"] });
			expect(dropRes.stopped).toBe(false);
			expect(getCarriedWeight(dropRes.state, world)).toBe(0);

			// Now taking chest_key succeeds: 0 + 2 = 2 <= 2
			const successRes = executeAction(bus, world, dropRes.state, "take", { objects: ["chest_key"] });
			expect(successRes.stopped).toBe(false);
			expect(successRes.feedback).toContain("Taken.");
			expect(successRes.state.objects.chest_key.location).toBe("inventory");
			expect(getCarriedWeight(successRes.state, world)).toBe(2);
		});

		it("taking an item already inside a carried container does not double-count weight", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 3,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					pouch: {
						id: "pouch",
						name: "small pouch",
						aliases: [],
						type: "container",
						location: "inventory",
						weight: 1,
						state: { open: true, carriable: true },
						descriptions: { default: "A pouch." },
					},
					ruby: {
						id: "ruby",
						name: "red ruby",
						aliases: [],
						type: "item",
						location: "pouch",
						weight: 1,
						state: {},
						descriptions: { default: "A ruby." },
					},
				},
			});

			// sword (1) + pouch (1) + ruby (1) = 3 (at max capacity)
			expect(getCarriedWeight(state, world)).toBe(3);

			// Taking ruby out of pouch into direct inventory: already carried, so weight doesn't increase!
			const res = executeAction(bus, world, state, "take", { objects: ["ruby"] });
			expect(res.stopped).toBe(false);
			expect(res.feedback).toContain("Taken.");
			expect(res.state.objects.ruby.location).toBe("inventory");
			expect(getCarriedWeight(res.state, world)).toBe(3);
		});
	});

	describe("Multi-Object Take Under Weight Limits", () => {
		it("takes all objects when total weight is within capacity", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 5,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					gem: { ...makeTestWorld().objects.gem, location: "room_a", weight: 1 },
					lamp: { ...makeTestWorld().objects.lamp, location: "room_a", weight: 1 },
				},
			});

			// sword = 1. candidate: lamp (1) + gem (1) -> total 3 <= 5
			const res = executeAction(bus, world, state, "take", { objects: ["lamp", "gem"] });
			expect(res.stopped).toBe(false);
			expect(res.feedback).toContain("brass lamp: Taken.");
			expect(res.feedback).toContain("red gem: Taken.");
			expect(res.state.objects.lamp.location).toBe("inventory");
			expect(res.state.objects.gem.location).toBe("inventory");
			expect(getCarriedWeight(res.state, world)).toBe(3);
		});

		it("partially takes objects until capacity is reached, rejecting the rest", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 3,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					item1: {
						id: "item1",
						name: "item one",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 1,
						state: {},
						descriptions: { default: "First item." },
					},
					item2: {
						id: "item2",
						name: "item two",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 2,
						state: {},
						descriptions: { default: "Second item." },
					},
				},
			});

			// sword = 1. capacity = 3.
			// item1 (weight 1): current 1 + 1 = 2 <= 3 -> Taken!
			// item2 (weight 2): current 2 + 2 = 4 > 3 -> Rejected!
			const res = executeAction(bus, world, state, "take", { objects: ["item1", "item2"] });
			expect(res.stopped).toBe(false); // at least one item taken
			expect(res.feedback).toContain("item one: Taken.");
			expect(res.feedback).toContain("item two: Your load is too heavy.");
			expect(res.state.objects.item1.location).toBe("inventory");
			expect(res.state.objects.item2.location).toBe("room_a");
			expect(getCarriedWeight(res.state, world)).toBe(2);
		});

		it("stops and rejects all items when none can fit", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 1, // already full with sword (weight 1)
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					item1: {
						id: "item1",
						name: "item one",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 1,
						state: {},
						descriptions: { default: "First item." },
					},
					item2: {
						id: "item2",
						name: "item two",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 1,
						state: {},
						descriptions: { default: "Second item." },
					},
				},
			});

			const res = executeAction(bus, world, state, "take", { objects: ["item1", "item2"] });
			expect(res.stopped).toBe(true); // 0 items taken
			expect(res.feedback).toContain("item one: Your load is too heavy.");
			expect(res.feedback).toContain("item two: Your load is too heavy.");
			expect(res.state.objects.item1.location).toBe("room_a");
			expect(res.state.objects.item2.location).toBe("room_a");
			expect(getCarriedWeight(res.state, world)).toBe(1);
		});

		it("correctly handles mix of already carrying, uncarriable, too heavy, and valid items", () => {
			const { world, bus, state } = setup({
				player: {
					current_room: "room_a",
					capacity: 3,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					table: { ...makeTestWorld().objects.table, location: "room_a" },
					feather: {
						id: "feather",
						name: "light feather",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 0,
						state: {},
						descriptions: { default: "A weightless feather." },
					},
					heavy_gold: {
						id: "heavy_gold",
						name: "gold bar",
						aliases: [],
						type: "item",
						location: "room_a",
						weight: 10,
						state: {},
						descriptions: { default: "A very heavy gold bar." },
					},
				},
			});

			// sword is already in inventory (1).
			// feather: weight 0 -> taken (total weight 1)
			// table: carriable false -> can't take that
			// heavy_gold: weight 10 -> too heavy (1 + 10 = 11 > 3)
			const res = executeAction(bus, world, state, "take", {
				objects: ["sword", "feather", "table", "heavy_gold"],
			});

			expect(res.stopped).toBe(false);
			expect(res.feedback).toContain("iron sword: You're already carrying that.");
			expect(res.feedback).toContain("light feather: Taken.");
			expect(res.feedback).toContain("oak table: You can't take that.");
			expect(res.feedback).toContain("gold bar: Your load is too heavy.");
			expect(res.state.objects.feather.location).toBe("inventory");
			expect(getCarriedWeight(res.state, world)).toBe(1);
		});
	});

	describe("End-to-End GameEngine Integration", () => {
		it("enforces carry limit through GameEngine.runAction()", () => {
			const world = makeTestWorld({
				player: {
					current_room: "room_a",
					capacity: 2,
					state: {},
				},
				objects: {
					...makeTestWorld().objects,
					heavy_lead: {
						id: "heavy_lead",
						name: "block of lead",
						aliases: ["lead"],
						type: "item",
						location: "room_a",
						weight: 5,
						state: {},
						descriptions: { default: "A heavy lead block." },
					},
				},
			});

			const engine = new GameEngine(world);
			engine.start();

			// Initial inventory has sword (weight 1)
			const invBefore = engine.runAction({ action: "inventory" });
			expect(invBefore).toContain("iron sword");

			// Taking heavy_lead should be rejected
			const takeHeavy = engine.runAction({ action: "take", objects: ["heavy_lead"] });
			expect(takeHeavy).toBe("Your load is too heavy.");

			// Taking lamp (weight 1) succeeds (1 + 1 = 2 <= 2)
			const takeLamp = engine.runAction({ action: "take", objects: ["lamp"] });
			expect(takeLamp).toBe("Taken.");

			// Now at max capacity (2); taking anything else with weight >= 1 fails
			const state = engine.save().state;
			expect(getCarriedWeight(state, world)).toBe(2);
		});
	});
});
