import { describe, expect, it } from "vitest";
import { splitCommands, tryDeterministicIntent } from "./fast-path-parser";

describe("splitCommands", () => {
	it("splits period-chained commands without spaces (Infocom style)", () => {
		expect(splitCommands("DOWN.SOUTH.TAKE DART GUN.WEST.UP")).toEqual(["DOWN", "SOUTH", "TAKE DART GUN", "WEST", "UP"]);
	});

	it("splits period-chained commands with spaces", () => {
		expect(splitCommands("DOWN. SOUTH. TAKE DART GUN. WEST. UP")).toEqual([
			"DOWN",
			"SOUTH",
			"TAKE DART GUN",
			"WEST",
			"UP",
		]);
	});

	it("splits semicolon-delimited commands", () => {
		expect(splitCommands("look; wait; inventory")).toEqual(["look", "wait", "inventory"]);
	});

	it("splits newline-delimited commands (LF and CRLF)", () => {
		expect(splitCommands("go north\ngo south\r\nlook")).toEqual(["go north", "go south", "look"]);
	});

	it("handles mixed period, semicolon, and newline delimiters", () => {
		expect(splitCommands("look. inventory; wait\nquit")).toEqual(["look", "inventory", "wait", "quit"]);
	});

	it("handles trailing periods and multiple consecutive delimiters gracefully", () => {
		expect(splitCommands("look.")).toEqual(["look"]);
		expect(splitCommands("DOWN...SOUTH;;TAKE DART GUN\n\nWEST.UP.")).toEqual([
			"DOWN",
			"SOUTH",
			"TAKE DART GUN",
			"WEST",
			"UP",
		]);
	});

	it("returns empty array for empty or whitespace-only inputs", () => {
		expect(splitCommands("")).toEqual([]);
		expect(splitCommands("   ")).toEqual([]);
		expect(splitCommands("...;;;\n\n")).toEqual([]);
	});
});

describe("tryDeterministicIntent", () => {
	it("parses single-letter directions with or without trailing period", () => {
		expect(tryDeterministicIntent("n.")).toEqual({
			action: "go",
			direction: "north",
			objects: null,
			preposition: null,
			message: null,
		});
	});
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
		expect(tryDeterministicIntent("restart")?.action).toBe("restart");
		expect(tryDeterministicIntent("diagnose")?.action).toBe("diagnose");
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
		expect(tryDeterministicIntent("brief")).toEqual({
			action: "brief",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("brief.")?.action).toBe("brief");
		expect(tryDeterministicIntent("superbrief")).toEqual({
			action: "superbrief",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("super brief")?.action).toBe("superbrief");
		expect(tryDeterministicIntent("super-brief.")?.action).toBe("superbrief");
		expect(tryDeterministicIntent("verbose")).toEqual({
			action: "verbose",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("verbose.")?.action).toBe("verbose");
	});

	it("parses verb frame command candidates (attack, unlock, lock, light, turn on/off, open, close)", () => {
		// Zero-arg commands awaiting verb frame assumptions
		expect(tryDeterministicIntent("attack")).toEqual({
			action: "attack",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("kill")?.action).toBe("attack");
		expect(tryDeterministicIntent("fight")?.action).toBe("attack");
		expect(tryDeterministicIntent("hit")?.action).toBe("attack");
		expect(tryDeterministicIntent("strike")?.action).toBe("attack");

		// Single and two-arg attack
		expect(tryDeterministicIntent("attack troll")).toEqual({
			action: "attack",
			direction: null,
			objects: ["troll"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("kill the troll with the elvish sword")).toEqual({
			action: "attack",
			direction: null,
			objects: ["troll", "elvish sword"],
			preposition: "with",
			message: null,
		});

		// Unlock & Lock
		expect(tryDeterministicIntent("unlock")?.action).toBe("unlock");
		expect(tryDeterministicIntent("unlock the cellar door")).toEqual({
			action: "unlock",
			direction: null,
			objects: ["cellar door"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("unlock door with rusty key")).toEqual({
			action: "unlock",
			direction: null,
			objects: ["door", "rusty key"],
			preposition: "with",
			message: null,
		});
		expect(tryDeterministicIntent("lock")?.action).toBe("lock");
		expect(tryDeterministicIntent("lock chest with key")).toEqual({
			action: "lock",
			direction: null,
			objects: ["chest", "key"],
			preposition: "with",
			message: null,
		});

		// Light / Turn On
		expect(tryDeterministicIntent("light")?.action).toBe("turn_on");
		expect(tryDeterministicIntent("turn on")?.action).toBe("turn_on");
		expect(tryDeterministicIntent("switch on")?.action).toBe("turn_on");
		expect(tryDeterministicIntent("turn on the brass lantern")).toEqual({
			action: "turn_on",
			direction: null,
			objects: ["brass lantern"],
			preposition: null,
			message: null,
		});

		// Turn Off / Extinguish
		expect(tryDeterministicIntent("turn off")?.action).toBe("turn_off");
		expect(tryDeterministicIntent("extinguish")?.action).toBe("turn_off");
		expect(tryDeterministicIntent("extinguish lamp")).toEqual({
			action: "turn_off",
			direction: null,
			objects: ["lamp"],
			preposition: null,
			message: null,
		});

		// Open / Close
		expect(tryDeterministicIntent("open")?.action).toBe("open");
		expect(tryDeterministicIntent("close")?.action).toBe("close");
		expect(tryDeterministicIntent("shut")?.action).toBe("close");
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
