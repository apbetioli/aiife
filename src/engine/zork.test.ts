import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { world, setup as zorkSetup } from "../../games/zork-one";
import { WorldSchema } from "../world/types";
import { buildInitialState } from "./initial-state";
import { buildParserContext } from "./parser-context";
import { ActionRegistry, EventBus } from "./rules";
import { registerCoreActions } from "./rules/core-actions";
import { executeAction } from "./rules/executor";

describe("Zork One world definition and rules", () => {
	function setup() {
		const bus = new EventBus();
		const registry = new ActionRegistry();
		registerCoreActions(bus, registry);
		zorkSetup?.(bus, registry);
		const state = buildInitialState(world);
		return { bus, state };
	}

	it("validates and builds initial state for zork-one (TS) without errors", () => {
		expect(() => WorldSchema.parse(world)).not.toThrow();
		const state = buildInitialState(world);
		expect(state.player.current_room).toBe("west_of_house");
		expect(state.objects.front_door).toBeDefined();
		expect(state.objects.small_mailbox).toBeDefined();
		expect(state.objects.leaflet).toBeDefined();
		expect(state.objects.welcome_mat).toBeUndefined();
	});

	it("validates that games/zork.json is a valid standalone JSON world definition", () => {
		const raw = readFileSync(resolve(__dirname, "../../games/zork.json"), "utf-8");
		const jsonWorld = WorldSchema.parse(JSON.parse(raw));
		const state = buildInitialState(jsonWorld);
		expect(state.world_id).toBe("zork-one");
		expect(state.player.current_room).toBe("west_of_house");
		expect(state.objects.small_mailbox).toBeDefined();
		expect(state.objects.front_door).toBeDefined();
	});

	it("look only describes mailbox and room, hiding scenery front door", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "look", {});

		expect(result.stopped).toBe(false);
		const text = result.feedback.join("\n");
		expect(text).toContain("West of House");
		expect(text).toContain("You are standing in an open field west of a white house, with a boarded front door.");
		expect(text).toContain("There is a small mailbox here.");
		expect(text).not.toContain("The front door of the white house. It is firmly boarded shut");
		expect(text).not.toContain("welcome mat");
	});

	it("examine front door and boards returns the door description", () => {
		const { bus, state } = setup();
		const resultDoor = executeAction(bus, world, state, "examine", { objects: ["front_door"] });
		expect(resultDoor.stopped).toBe(false);
		expect(resultDoor.feedback.join(" ")).toContain("It is firmly boarded shut and cannot be opened.");
	});

	it("open front door returns cannot open message via setup rule", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "open", { objects: ["front_door"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The door cannot be opened.");
	});

	it("go east is blocked by the boarded door", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "go", { direction: "east" });
		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The door is boarded and you can't remove the boards.");
	});

	it("opening the mailbox reveals the leaflet and brings it into scope", () => {
		const { bus, state } = setup();

		// Initially mailbox is closed, leaflet is not in scope
		const ctxClosed = buildParserContext(world, state);
		const closedIds = ctxClosed.in_scope_objects.map((o) => o.id);
		expect(closedIds).toContain("small_mailbox");
		expect(closedIds).toContain("front_door");
		expect(closedIds).not.toContain("leaflet");

		// Open mailbox
		const openResult = executeAction(bus, world, state, "open", { objects: ["small_mailbox"] });
		expect(openResult.stopped).toBe(false);
		expect(openResult.feedback.join("\n")).toContain("Opening the small mailbox reveals:\n  leaflet");

		// Now leaflet is in scope
		const ctxOpen = buildParserContext(world, openResult.state);
		const openIds = ctxOpen.in_scope_objects.map((o) => o.id);
		expect(openIds).toContain("leaflet");

		// Can take the leaflet
		const takeResult = executeAction(bus, world, openResult.state, "take", { objects: ["leaflet"] });
		expect(takeResult.stopped).toBe(false);
		expect(takeResult.state.player.inventory).toContain("leaflet");

		// Can examine / read the leaflet
		const readResult = executeAction(bus, world, takeResult.state, "examine", { objects: ["leaflet"] });
		expect(readResult.stopped).toBe(false);
		expect(readResult.feedback.join(" ")).toContain("WELCOME TO ZORK!");
		expect(readResult.feedback.join(" ")).toContain("adventure, danger, and low cunning");
	});

	it("can examine/read the leaflet directly inside the open mailbox without taking it first", () => {
		const { bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["small_mailbox"] });
		expect(openResult.stopped).toBe(false);

		const readResult = executeAction(bus, world, openResult.state, "examine", { objects: ["leaflet"] });
		expect(readResult.stopped).toBe(false);
		expect(readResult.feedback.join(" ")).toContain("WELCOME TO ZORK!");
	});
});
