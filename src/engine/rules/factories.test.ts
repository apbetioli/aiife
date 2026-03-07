import { describe, expect, it } from "vitest";
import { makeTestWorld } from "../__fixtures__/test-world";
import { buildInitialState } from "../initial-state";
import { registerCoreActions } from "./core-actions";
import { executeAction } from "./executor";
import { ActionRegistry, EventBus } from "./index";

describe("unlock with requires_instrument", () => {
	function setupLockable() {
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "sword" },
				},
			},
		});
		const bus = new EventBus();
		registerCoreActions(bus, new ActionRegistry());
		const state = buildInitialState(world);
		return { world, bus, state };
	}

	it("correct key unlocks", () => {
		const { world, bus, state } = setupLockable();

		const result = executeAction(bus, world, state, "unlock", {
			objects: ["door", "sword"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.door.state.locked).toBe(false);
	});

	it("wrong key is blocked", () => {
		// door requires "sword" but we use a different key in inventory
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "brass_key" },
				},
			},
		});
		const bus = new EventBus();
		registerCoreActions(bus, new ActionRegistry());
		const state = buildInitialState(world);

		// sword is in inventory but isn't the right key
		const result = executeAction(bus, world, state, "unlock", {
			objects: ["door", "sword"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("That doesn't fit the lock.");
	});
});
