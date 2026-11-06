import { describe, expect, it } from "vitest";
import { tryDeterministicIntent } from "./fast-path-parser";

describe("tryDeterministicIntent", () => {
	it("parses single-letter directions", () => {
		expect(tryDeterministicIntent("n")).toEqual({
			action: "go",
			direction: "north",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("s")).toEqual({
			action: "go",
			direction: "south",
			objects: null,
			preposition: null,
			message: null,
		});
	});

	it("parses full direction names and phrases", () => {
		expect(tryDeterministicIntent("north")).toEqual({
			action: "go",
			direction: "north",
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("go west")).toEqual({
			action: "go",
			direction: "west",
			objects: null,
			preposition: null,
			message: null,
		});
	});

	it("parses look, inventory, help, and quit", () => {
		expect(tryDeterministicIntent("l")?.action).toBe("look");
		expect(tryDeterministicIntent("look")?.action).toBe("look");
		expect(tryDeterministicIntent("i")?.action).toBe("inventory");
		expect(tryDeterministicIntent("inv")?.action).toBe("inventory");
		expect(tryDeterministicIntent("h")?.action).toBe("help");
		expect(tryDeterministicIntent("q")?.action).toBe("quit");
		expect(tryDeterministicIntent("undo")?.action).toBe("undo");
		expect(tryDeterministicIntent("save")?.action).toBe("save");
		expect(tryDeterministicIntent("save slot1")).toEqual({
			action: "save",
			slot: "slot1",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("restore")?.action).toBe("restore");
		expect(tryDeterministicIntent("load slot2")).toEqual({
			action: "restore",
			slot: "slot2",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
	});

	it("parses put, insert, and place commands", () => {
		expect(tryDeterministicIntent("put sword in chest")).toEqual({
			action: "put",
			objects: ["sword", "chest"],
			preposition: "in",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("insert gem into chest")).toEqual({
			action: "put",
			objects: ["gem", "chest"],
			preposition: "into",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("place lamp on table")).toEqual({
			action: "put",
			objects: ["lamp", "table"],
			preposition: "on",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("put sword")).toEqual({
			action: "put",
			objects: ["sword"],
			preposition: null,
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("put")).toEqual({
			action: "put",
			objects: [],
			preposition: null,
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("put sword on floor")).toEqual({
			action: "put",
			objects: ["sword", "floor"],
			preposition: "on",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("put sword on the floor")).toEqual({
			action: "put",
			objects: ["sword", "floor"],
			preposition: "on",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("place lamp on the ground")).toEqual({
			action: "put",
			objects: ["lamp", "ground"],
			preposition: "on",
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("put down sword")).toEqual({
			action: "drop",
			objects: ["sword"],
			preposition: null,
			direction: null,
			message: null,
		});
		expect(tryDeterministicIntent("drop the sword")).toEqual({
			action: "drop",
			objects: ["sword"],
			preposition: null,
			direction: null,
			message: null,
		});
	});

	it("returns null for natural language or complex commands", () => {
		expect(tryDeterministicIntent("take the brass key from table")).toBeNull();
		expect(tryDeterministicIntent("examine painting")).toBeNull();
		expect(tryDeterministicIntent("what should I do now?")).toBeNull();
	});
});
