import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { GameEngine } from "./game-engine";

describe("description_mode end-to-end", () => {
	it("initializes to brief mode by default", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		expect(engine.getDescriptionMode()).toBe("brief");
	});

	it("executes brief, superbrief, and verbose actions", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);

		const verboseFeedback = engine.runAction({ action: "verbose" });
		expect(verboseFeedback).toBe("Maximum verbosity.");
		expect(engine.getDescriptionMode()).toBe("verbose");

		const superbriefFeedback = engine.runAction({ action: "superbrief" });
		expect(superbriefFeedback).toBe("Superbrief descriptions.");
		expect(engine.getDescriptionMode()).toBe("superbrief");

		const briefFeedback = engine.runAction({ action: "brief" });
		expect(briefFeedback).toBe("Brief descriptions.");
		expect(engine.getDescriptionMode()).toBe("brief");
	});

	it("superbrief mode suppresses room description on look and room movement", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "superbrief" });

		const lookFeedback = engine.runAction({ action: "look" });
		expect(lookFeedback).toContain("**Room A**");
		expect(lookFeedback).not.toContain("You are in a bright room.");
		// Objects in scope are still listed
		expect(lookFeedback).toContain("A brass lamp");

		// Move south to room_b (first visit to room_b)
		const moveFeedback = engine.runAction({ action: "go", direction: "south" });
		expect(moveFeedback).toContain("**Room B**");
		expect(moveFeedback).not.toContain("You are in room B.");
	});

	it("verbose mode prints full description on every visit and look", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "verbose" });

		// First visit to room_b
		const moveSouth = engine.runAction({ action: "go", direction: "south" });
		expect(moveSouth).toContain("You are in room B.");

		// Look in room_b (already visited)
		const lookInB = engine.runAction({ action: "look" });
		expect(lookInB).toContain("You are in room B.");
		expect(lookInB).not.toContain("Room B again.");

		// Move south back to room_a (already visited)
		const moveBackToA = engine.runAction({ action: "go", direction: "south" });
		expect(moveBackToA).toContain("You are in room A.");
		expect(moveBackToA).not.toContain("Room A again.");
	});

	it("brief mode prints full description on first visit and short/visited on subsequent visits", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "brief" });

		// Room A is start_room (marked visited after start())
		const lookA = engine.runAction({ action: "look" });
		// Room A has descriptions.visited: "Room A again."
		expect(lookA).toContain("Room A again.");
		expect(lookA).not.toContain("You are in a bright room.");

		// Move to Room B for first time
		const moveB = engine.runAction({ action: "go", direction: "south" });
		// First visit shows full description
		expect(moveB).toContain("You are in room B.");
		expect(moveB).not.toContain("Room B again.");

		// Look again in Room B (now visited)
		const lookB = engine.runAction({ action: "look" });
		expect(lookB).toContain("Room B again.");
		expect(lookB).not.toContain("You are in room B.");
	});

	it("brief mode returns only room name and objects when room has no visited description", () => {
		const world = makeTestWorld({
			rooms: {
				...makeTestWorld().rooms,
				room_b: {
					...makeTestWorld().rooms.room_b,
					descriptions: {
						default: "Full description of room B only.",
					},
				},
			},
		});
		const engine = new GameEngine(world);
		engine.start();

		// First visit to room_b: shows full description
		const moveB = engine.runAction({ action: "go", direction: "south" });
		expect(moveB).toContain("Full description of room B only.");

		// Subsequent visit / look in room_b: visited is undefined, so description paragraph is omitted
		const lookB = engine.runAction({ action: "look" });
		expect(lookB).toContain("**Room B**");
		expect(lookB).not.toContain("Full description of room B only.");
	});

	it("preserves description_mode across save and restore", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "superbrief" });
		const saveFile = engine.save();

		const engine2 = new GameEngine(world);
		engine2.restore(saveFile);

		expect(engine2.getDescriptionMode()).toBe("superbrief");
		const look = engine2.runAction({ action: "look" });
		expect(look).toContain("**Room A**");
		expect(look).not.toContain("You are in a bright room.");
	});
});
