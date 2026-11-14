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
		expect(tryDeterministicIntent("z")?.action).toBe("wait");
		expect(tryDeterministicIntent("wait")?.action).toBe("wait");
		expect(tryDeterministicIntent("g")?.action).toBe("again");
		expect(tryDeterministicIntent("again")?.action).toBe("again");
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

	it("returns null for entity commands, delegating all entity resolution to the LLM agent", () => {
		expect(tryDeterministicIntent("take sword")).toBeNull();
		expect(tryDeterministicIntent("take the brass key from table")).toBeNull();
		expect(tryDeterministicIntent("drop sword")).toBeNull();
		expect(tryDeterministicIntent("drop swords")).toBeNull();
		expect(tryDeterministicIntent("drop the sword")).toBeNull();
		expect(tryDeterministicIntent("put sword in chest")).toBeNull();
		expect(tryDeterministicIntent("insert gem into chest")).toBeNull();
		expect(tryDeterministicIntent("place lamp on table")).toBeNull();
		expect(tryDeterministicIntent("examine painting")).toBeNull();
		expect(tryDeterministicIntent("what should I do now?")).toBeNull();
	});
});
