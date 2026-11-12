import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/engine/game-engine";
import { WorldSchema } from "../src/world/types";
import trollGame from "./troll";

describe("Troll game rules and integration", () => {
	const { world, setup } = trollGame;

	it("validates world schema", () => {
		expect(() => WorldSchema.parse(world)).not.toThrow();
	});

	it("prevents going north while troll is awake", () => {
		const engine = new GameEngine(world, setup);

		// Go east to troll room
		const goEast = engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(goEast).toContain("The Troll Room");
		expect(goEast).toContain("The troll's mighty blow drops you to your knees.");

		// Try to go north past the troll
		const goNorth = engine.runAction({
			action: "go",
			direction: "north",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(goNorth).toContain("The troll blocks your way north with a menacing snarl!");
	});

	it("executes original troll combat scenario with sword and allows passage to treasure room", () => {
		const engine = new GameEngine(world, setup);

		// Take metal sword in cellar
		const takeSword = engine.runAction({
			action: "take",
			direction: null,
			objects: ["metal_sword"],
			preposition: null,
			message: null,
		});
		expect(takeSword).toContain("Taken.");

		// Go east to troll room
		const goEast = engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(goEast).toContain("The Troll Room");
		expect(goEast).toContain("Your sword has begun to glow very brightly.");
		expect(goEast).toContain("The troll's mighty blow drops you to your knees.");

		// Turn 1: recovering
		const a1 = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(a1).toContain("You are still recovering from that last blow, so your attack is ineffective.");
		expect(a1).toContain("The troll's axe barely misses your ear.");

		// Turn 2: parries
		const a2 = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(a2).toContain("Clang! Crash! The troll parries.");
		expect(a2).toContain("The troll's axe barely misses your ear.");

		// Turn 3: confused
		const a3 = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(a3).toContain("The troll is confused and can't fight back.");
		expect(a3).toContain("The troll slowly regains his feet.");

		// Turn 4: knocked out
		const a4 = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(a4).toContain("The troll is knocked out!");

		// Turn 5: dies
		const a5 = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(a5).toContain("The unconscious troll cannot defend himself: He dies.");
		expect(a5).toContain(
			"Almost as soon as the troll breathes his last breath, a cloud of sinister black fog envelops him",
		);
		expect(a5).toContain("Your sword is no longer glowing.");

		// Now passage north is clear
		const goNorth = engine.runAction({
			action: "go",
			direction: "north",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(goNorth).toContain("Treasure Room");
	});

	it("talking to troll returns dialogue", () => {
		const engine = new GameEngine(world, setup);
		engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});

		const talk = engine.runAction({
			action: "talk",
			direction: null,
			objects: ["troll"],
			preposition: null,
			message: null,
		});
		expect(talk).toContain("Me SMASH!");
	});
});
