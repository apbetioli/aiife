import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { GameEngine } from "./game-engine";
import { load, save } from "./save";

describe("Tutorial / Easy mode end-to-end", () => {
	it("initializes to tutorial mode off by default", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		expect(engine.isTutorialMode()).toBe(false);
	});

	it("initializes with tutorial mode when option is true", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { tutorial: true });
		expect(engine.isTutorialMode()).toBe(true);

		const engine2 = new GameEngine(world, { tutorial_mode: true });
		expect(engine2.isTutorialMode()).toBe(true);
	});

	it("initializes with tutorial mode when defined on world player state", () => {
		const world = makeTestWorld();
		world.player.state = { tutorial_mode: true };
		const engine = new GameEngine(world);
		expect(engine.isTutorialMode()).toBe(true);
	});

	it("toggles tutorial mode via tutorial and easy actions", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);

		// Toggle on
		const onFeedback = engine.runAction({ action: "tutorial" });
		expect(onFeedback).toContain("mode is now ON");
		expect(engine.isTutorialMode()).toBe(true);

		// Toggle off
		const offFeedback = engine.runAction({ action: "tutorial" });
		expect(offFeedback).toContain("mode is now OFF");
		expect(engine.isTutorialMode()).toBe(false);

		// Toggle on with easy alias
		const easyFeedback = engine.runAction({ action: "easy" });
		expect(easyFeedback).toContain("mode is now ON");
		expect(engine.isTutorialMode()).toBe(true);

		// Explicit off
		const explicitOff = engine.runAction({ action: "tutorial", enabled: false });
		expect(explicitOff).toContain("mode is now OFF");
		expect(engine.isTutorialMode()).toBe(false);

		// Explicit on
		const explicitOn = engine.runAction({ action: "tutorial", enabled: true });
		expect(explicitOn).toContain("mode is now ON");
		expect(engine.isTutorialMode()).toBe(true);
	});

	it("highlights room description, exits, and in-scope objects in start() and look", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { tutorial: true, highlightFormat: "tags" });

		const startOutput = engine.start();
		// In room_a, objects are brass lamp, wooden door, wooden chest, iron sword (inventory). Exit is south.
		expect(startOutput).toContain("<item>brass lamp</item>");
		expect(startOutput).toContain("<item>wooden door</item>");
		expect(startOutput).toContain("<item>wooden chest</item>");

		// Explicit look also highlights
		const lookOutput = engine.runAction({ action: "look" });
		expect(lookOutput).toContain("<item>brass lamp</item>");
		expect(lookOutput).toContain("<item>wooden door</item>");
	});

	it("highlights in ANSI format when configured", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { tutorial: true, highlightFormat: "ansi" });

		const startOutput = engine.start();
		// Bold cyan item (\u001b[1;36m)
		expect(startOutput).toContain("\u001b[1;36mbrass lamp\u001b[0m");
		expect(startOutput).toContain("\u001b[1;36mwooden door\u001b[0m");
	});

	it("highlights in markdown format when configured", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { tutorial: true, highlightFormat: "markdown" });

		const startOutput = engine.start();
		expect(startOutput).toContain("[item:brass lamp]");
		expect(startOutput).toContain("[item:wooden door]");
	});

	it("stops highlighting once tutorial mode is turned off", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world, { tutorial: true });
		engine.start();

		// Turn off
		engine.runAction({ action: "tutorial", enabled: false });
		expect(engine.isTutorialMode()).toBe(false);

		const plainLook = engine.runAction({ action: "look" });
		expect(plainLook).not.toContain("<item>");
		expect(plainLook).not.toContain("<exit>");
		expect(plainLook).toContain("brass lamp");
	});

	it("highlights newly visited room after go action", () => {
		const world = makeTestWorld();
		world.rooms.room_b.descriptions.default = "You are in room B. A passage leads south.";
		const engine = new GameEngine(world, { tutorial: true, highlightFormat: "tags" });
		engine.start();

		// Move south into room_b (unconditional exit)
		const goOutput = engine.runAction({ action: "go", direction: "south" });
		expect(goOutput).toContain("**Room B**");
		expect(goOutput).toContain("<exit>south</exit>");
		expect(goOutput).toContain("<item>oak table</item>");
	});

	it("preserves tutorial_mode across save and restore", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "tutorial", enabled: true });
		expect(engine.isTutorialMode()).toBe(true);

		const saveFile = engine.save();
		const saved = save(engine.getState());
		const restoredState = load(saved);

		expect(restoredState.tutorial_mode).toBe(true);

		// Restore in a fresh engine
		const engine2 = new GameEngine(world);
		expect(engine2.isTutorialMode()).toBe(false);
		engine2.restore(saveFile);
		expect(engine2.isTutorialMode()).toBe(true);
	});

	it("preserves tutorial_mode across undo", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		expect(engine.isTutorialMode()).toBe(false);

		// Turn on tutorial mode
		engine.runAction({ action: "tutorial", enabled: true });
		expect(engine.isTutorialMode()).toBe(true);

		// Take an action
		engine.runAction({ action: "look" });

		// Undo previous turn
		engine.undo();
		expect(engine.isTutorialMode()).toBe(true);
	});
});
