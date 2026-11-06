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

		// Go east to troll cave
		const goEast = engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(goEast).toContain("Troll Cave");

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

	it("knocks out troll with metal sword and allows passage to treasure room", () => {
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

		// Go east to troll cave
		engine.runAction({
			action: "go",
			direction: "east",
			objects: null,
			preposition: null,
			message: null,
		});

		// Attack troll with metal sword
		const attack = engine.runAction({
			action: "attack",
			direction: null,
			objects: ["troll", "metal_sword"],
			preposition: null,
			message: null,
		});
		expect(attack).toContain("unconscious");

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
