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

		bus.on("examine", (event, _state, _w) => {
			calls.push((event.params.objects as string[])[0]);
		});

		const event = new GameEvent("examine", { objects: ["lamp"] });
		bus.emit(event, world, freshState());
		expect(calls).toEqual(["lamp"]);
	});

	it("scoped listener fires only when scope matches", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.on("examine", "room_a", (_event, _state, _w) => {
			calls.push("room_a");
		});
		bus.on("examine", "room_b", (_event, _state, _w) => {
			calls.push("room_b");
		});

		const event = new GameEvent("examine", { objects: ["lamp"] });
		// Player starts in room_a
		bus.emit(event, world, freshState());
		expect(calls).toEqual(["room_a"]);
	});

	it("scoped listener wins over global at same priority", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.on("examine", (_event, _state, _w) => {
			calls.push("global");
		});
		bus.on("examine", "lamp", (_event, _state, _w) => {
			calls.push("scoped");
		});

		const event = new GameEvent("examine", { objects: ["lamp"] });
		bus.emit(event, world, freshState());
		// Scoped wins, global should not fire at the same priority
		expect(calls).toEqual(["scoped"]);
	});

	it("global fires when no scoped listener matches", () => {
		const bus = new EventBus();
		const calls: string[] = [];

		bus.on("examine", (_event, _state, _w) => {
			calls.push("global");
		});
		bus.on("examine", "nonexistent", (_event, _state, _w) => {
			calls.push("scoped");
		});

		const event = new GameEvent("examine", { objects: ["lamp"] });
		bus.emit(event, world, freshState());
		expect(calls).toEqual(["global"]);
	});

	it("sorts listeners by priority (lower runs first)", () => {
		const bus = new EventBus();
		const order: number[] = [];

		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push(200);
			},
			{ priority: 200 },
		);

		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push(50);
			},
			{ priority: 50 },
		);

		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push(100);
			},
			{ priority: 100 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		bus.emit(event, world, freshState());
		expect(order).toEqual([50, 100, 200]);
	});

	it("same-priority listeners run in registration order", () => {
		const bus = new EventBus();
		const order: string[] = [];

		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push("first");
			},
			{ priority: 100 },
		);
		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push("second");
			},
			{ priority: 100 },
		);
		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push("third");
			},
			{ priority: 100 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		bus.emit(event, world, freshState());
		expect(order).toEqual(["first", "second", "third"]);
	});

	it("once: true listener fires exactly once then is removed", () => {
		const bus = new EventBus();
		let count = 0;

		bus.on(
			"tick",
			(_e, _state, _w) => {
				count++;
			},
			{ once: true },
		);

		const makeEvent = () => new GameEvent("tick", {} as Record<string, never>);

		bus.emit(makeEvent(), world, freshState());
		bus.emit(makeEvent(), world, freshState());
		bus.emit(makeEvent(), world, freshState());

		expect(count).toBe(1);
	});

	it("return-based cancellation stops later priorities", () => {
		const bus = new EventBus();
		const order: string[] = [];

		bus.on(
			"take",
			(event, _state, _w) => {
				order.push("guard");
				event.stop();
				return "A valiant attempt.";
			},
			{ priority: 50 },
		);

		bus.on(
			"take",
			(_event, _state, _w) => {
				order.push("mutation");
			},
			{ priority: 100 },
		);

		const event = new GameEvent("take", { objects: ["lamp"] });
		const result = bus.emit(event, world, freshState());

		expect(order).toEqual(["guard"]);
		expect(result.stopped).toBe(true);
		expect(result.feedback).toEqual(["A valiant attempt."]);
	});

	it("cancellation stops remaining listeners at same priority", () => {
		const bus = new EventBus();
		const order: string[] = [];

		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push("first");
			},
			{ priority: 100 },
		);
		bus.on(
			"tick",
			(event, _state, _w) => {
				order.push("second");
				event.stop();
				return "Stop";
			},
			{ priority: 100 },
		);
		bus.on(
			"tick",
			(_e, _state, _w) => {
				order.push("third");
			},
			{ priority: 100 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		const result = bus.emit(event, world, freshState());

		expect(order).toEqual(["first", "second"]);
		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("Stop");
	});

	it("cancel reason appears in feedback", () => {
		const bus = new EventBus();

		bus.on(
			"take",
			(event, _state, _w) => {
				event.stop();
				return "You can't take that.";
			},
			{ priority: 50 },
		);

		const event = new GameEvent("take", { objects: ["table"] });
		const result = bus.emit(event, world, freshState());

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You can't take that.");
	});

	it("multiple listeners at different priorities accumulate state changes", () => {
		const bus = new EventBus();

		bus.on(
			"tick",
			(_e, state, _w) => {
				state.turn += 1;
			},
			{ priority: 100 },
		);

		bus.on(
			"tick",
			(_e, state, _w) => {
				state.turn += 10;
			},
			{ priority: 200 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		const state = freshState();
		const initial = state.turn;
		const result = bus.emit(event, world, state);
		expect(result.state.turn).toBe(initial + 11);
	});

	it("unsubscribe removes the listener", () => {
		const bus = new EventBus();
		let count = 0;

		const unsub = bus.on("tick", (_e, _state, _w) => {
			count++;
		});

		const makeEvent = () => new GameEvent("tick", {} as Record<string, never>);

		bus.emit(makeEvent(), world, freshState());
		expect(count).toBe(1);

		unsub();
		bus.emit(makeEvent(), world, freshState());
		expect(count).toBe(1);
	});

	it("feedback accumulates across priorities", () => {
		const bus = new EventBus();

		bus.on(
			"tick",
			(_e, _state, _w) => {
				return ["First"];
			},
			{ priority: 100 },
		);

		bus.on(
			"tick",
			(_e, _state, _w) => {
				return ["Second"];
			},
			{ priority: 200 },
		);

		const event = new GameEvent("tick", {} as Record<string, never>);
		const result = bus.emit(event, world, freshState());
		expect(result.feedback).toEqual(["First", "Second"]);
	});
});
