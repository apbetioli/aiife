import { describe, expect, it } from "vitest";
import { makeTestWorld } from "../__fixtures__/test-world";
import { buildInitialState } from "../initial-state";
import { EventBus } from "./event-bus";
import { GameEvent } from "./types";

const world = makeTestWorld();

function freshState() {
	return buildInitialState(world);
}

describe("EventBus", () => {
	it("registers and emits a global listener", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.onGlobal("on", "examine", (event, state, _w) => {
			calls.push(event.params.target);
			return state;
		});

		const event = new GameEvent("examine", { target: "lamp" });
		event.phase = "on";

		bus.emit(event, world, freshState());
		expect(calls).toEqual(["lamp"]);
	});

	it("room-scoped listener fires only in matching room", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.onRoom("on", "examine", "room_a", (_event, state, _w) => {
			calls.push("room_a");
			return state;
		});
		bus.onRoom("on", "examine", "room_b", (_event, state, _w) => {
			calls.push("room_b");
			return state;
		});

		const event = new GameEvent("examine", { target: "lamp" });
		event.phase = "on";

		// Player starts in room_a
		bus.emit(event, world, freshState());
		expect(calls).toEqual(["room_a"]);
	});

	it("object-scoped listener fires only for matching target", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.onObject("on", "examine", "lamp", (_event, state, _w) => {
			calls.push("lamp");
			return state;
		});
		bus.onObject("on", "examine", "sword", (_event, state, _w) => {
			calls.push("sword");
			return state;
		});

		const event = new GameEvent("examine", { target: "lamp" });
		event.phase = "on";

		bus.emit(event, world, freshState());
		expect(calls).toEqual(["lamp"]);
	});

	it("sorts listeners by priority (lower runs first)", () => {
		const bus = new EventBus();
		const order: number[] = [];

		bus.onGlobal(
			"on",
			"tick",
			(_e, state, _w) => {
				order.push(200);
				return state;
			},
			{ priority: 200 },
		);

		bus.onGlobal(
			"on",
			"tick",
			(_e, state, _w) => {
				order.push(50);
				return state;
			},
			{ priority: 50 },
		);

		bus.onGlobal(
			"on",
			"tick",
			(_e, state, _w) => {
				order.push(100);
				return state;
			},
			{ priority: 100 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		event.phase = "on";

		bus.emit(event, world, freshState());
		expect(order).toEqual([50, 100, 200]);
	});

	it("once: true listener fires exactly once then is removed", () => {
		const bus = new EventBus();
		let count = 0;

		bus.onGlobal(
			"on",
			"tick",
			(_e, state, _w) => {
				count++;
				return state;
			},
			{ once: true },
		);

		const makeEvent = () => {
			const e = new GameEvent("tick", {} as Record<string, never>);
			e.phase = "on";
			return e;
		};

		bus.emit(makeEvent(), world, freshState());
		bus.emit(makeEvent(), world, freshState());
		bus.emit(makeEvent(), world, freshState());

		expect(count).toBe(1);
	});

	it("before cancellation prevents on/after phases from running", () => {
		const bus = new EventBus();
		const phases: string[] = [];

		bus.onGlobal("before", "take", (event, state, _w) => {
			phases.push("before");
			event.cancel("Nope.");
			return state;
		});
		bus.onGlobal("on", "take", (_event, state, _w) => {
			phases.push("on");
			return state;
		});
		bus.onGlobal("after", "take", (_event, state, _w) => {
			phases.push("after");
			return state;
		});

		// Manually run the three-phase pattern
		const state = freshState();
		const event = new GameEvent("take", { target: "lamp" });

		event.phase = "before";
		bus.emit(event, world, state);

		// on/after should not be emitted if cancelled
		if (!event.cancelled) {
			event.phase = "on";
			bus.emit(event, world, state);
			event.phase = "after";
			bus.emit(event, world, state);
		}

		expect(phases).toEqual(["before"]);
		expect(event.cancelled).toBe(true);
		expect(event.feedback).toContain("Nope.");
	});

	it("cancel reason appears in feedback", () => {
		const bus = new EventBus();

		bus.onGlobal("before", "take", (event, state, _w) => {
			event.cancel("You can't take that.");
			return state;
		});

		const event = new GameEvent("take", { target: "table" });
		event.phase = "before";

		bus.emit(event, world, freshState());

		expect(event.cancelled).toBe(true);
		expect(event.feedback).toContain("You can't take that.");
	});

	it("multiple listeners accumulate state changes", () => {
		const bus = new EventBus();

		bus.onGlobal("on", "tick", (_e, state, _w) => ({
			...state,
			turn: state.turn + 1,
		}));
		bus.onGlobal("on", "tick", (_e, state, _w) => ({
			...state,
			turn: state.turn + 10,
		}));

		const event = new GameEvent("tick", {} as Record<string, never>);
		event.phase = "on";

		const state = freshState();
		const initial = state.turn;
		const result = bus.emit(event, world, state);
		expect(result.state.turn).toBe(initial + 11);
	});

	it("unsubscribe removes the listener", () => {
		const bus = new EventBus();
		let count = 0;

		const unsub = bus.onGlobal("on", "tick", (_e, state, _w) => {
			count++;
			return state;
		});

		const makeEvent = () => {
			const e = new GameEvent("tick", {} as Record<string, never>);
			e.phase = "on";
			return e;
		};

		bus.emit(makeEvent(), world, freshState());
		expect(count).toBe(1);

		unsub();
		bus.emit(makeEvent(), world, freshState());
		expect(count).toBe(1);
	});
});
