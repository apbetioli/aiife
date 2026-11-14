import { describe, expect, it } from "vitest";
import {
	DEFAULT_KEY_VERBS,
	highlightTutorialText,
	stripHighlight,
	type TutorialHighlightContext,
} from "./tutorial-highlight";

describe("highlightTutorialText", () => {
	it("returns empty string when input is empty", () => {
		expect(highlightTutorialText("")).toBe("");
	});

	it("returns unchanged text when no candidates match", () => {
		const text = "Nothing interesting here.";
		expect(highlightTutorialText(text, {})).toBe(text);
	});

	it("highlights in-scope objects with <item> tags", () => {
		const context: TutorialHighlightContext = {
			objects: [
				{ name: "brass lantern", aliases: ["lantern"] },
				{ name: "rusty key", aliases: ["key"] },
			],
		};
		const text = "There is a brass lantern and a rusty key on the floor.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("There is a <item>brass lantern</item> and a <item>rusty key</item> on the floor.");
	});

	it("highlights aliases of in-scope objects", () => {
		const context: TutorialHighlightContext = {
			objects: [{ name: "brass lantern", aliases: ["lantern"] }],
		};
		const text = "The lantern shines brightly.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("The <item>lantern</item> shines brightly.");
	});

	it("highlights available exits with <exit> tags", () => {
		const context: TutorialHighlightContext = {
			exits: ["north", "southwest", "up"],
		};
		const text = "Passages lead north and southwest. Stairs go up.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toContain("<exit>north</exit>");
		expect(result).toContain("<exit>southwest</exit>");
		expect(result).toContain("<exit>up</exit>");
	});

	it("highlights key verbs with <verb> tags", () => {
		const text = "You can take the item, examine it, or drop it.";
		const result = highlightTutorialText(text, { objects: ["item"] }, { format: "tags" });
		expect(result).toContain("<verb>take</verb>");
		expect(result).toContain("<verb>examine</verb>");
		expect(result).toContain("<verb>drop</verb>");
		expect(result).toContain("<item>item</item>");
	});

	it("preserves exact text casing when highlighting", () => {
		const context: TutorialHighlightContext = {
			objects: [{ name: "brass lantern", aliases: ["lantern"] }],
			exits: ["north"],
		};
		const text = "A Brass Lantern lies to the North.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("A <item>Brass Lantern</item> lies to the <exit>North</exit>.");
	});

	it("respects word boundaries so substrings inside words are not highlighted", () => {
		const context: TutorialHighlightContext = {
			exits: ["go", "in", "out"],
		};
		const text = "He had forgotten about going into the golden room.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		// "go" should NOT match inside "forgotten" or "golden"
		expect(result).not.toContain("<exit>go</exit>tten");
		expect(result).not.toContain("<verb>go</verb>tten");
		expect(result).not.toContain("<exit>go</exit>lden");
	});

	it("prioritizes longer matches over shorter substrings", () => {
		const context: TutorialHighlightContext = {
			objects: [{ name: "heavy iron door", aliases: ["iron door", "door"] }],
		};
		const text = "A heavy iron door blocks the way.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("A <item>heavy iron door</item> blocks the way.");
		expect(result).not.toContain("<item>door</item>");
	});

	it("prioritizes object over exit or verb when lengths are equal", () => {
		// Suppose an object is named "north" or "look"
		const context: TutorialHighlightContext = {
			objects: ["north"],
			exits: ["north"],
		};
		const text = "Look to the north.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("<verb>Look</verb> to the <item>north</item>.");
	});

	it("supports ANSI format output", () => {
		const context: TutorialHighlightContext = {
			objects: ["sword"],
			exits: ["east"],
		};
		const text = "Take the sword and go east.";
		const result = highlightTutorialText(text, context, { format: "ansi" });
		expect(result).toContain("\u001b[1;36msword\u001b[0m"); // bold cyan item
		expect(result).toContain("\u001b[1;32meast\u001b[0m"); // bold green exit
		expect(result).toContain("\u001b[1;33mTake\u001b[0m"); // bold yellow verb
	});

	it("supports markdown format output", () => {
		const context: TutorialHighlightContext = {
			objects: ["amulet"],
			exits: ["down"],
		};
		const text = "The amulet fell down.";
		const result = highlightTutorialText(text, context, { format: "markdown" });
		expect(result).toBe("The [item:amulet] fell [exit:down].");
	});

	it("does not corrupt or duplicate already existing tags or ANSI codes", () => {
		const context: TutorialHighlightContext = {
			objects: ["key"],
			exits: ["north"],
		};
		const text = "You have a <item>key</item>. Walk north.";
		const result = highlightTutorialText(text, context, { format: "tags" });
		expect(result).toBe("You have a <item>key</item>. <verb>Walk</verb> <exit>north</exit>.");
	});

	it("DEFAULT_KEY_VERBS contains essential IF verbs", () => {
		expect(DEFAULT_KEY_VERBS).toContain("take");
		expect(DEFAULT_KEY_VERBS).toContain("drop");
		expect(DEFAULT_KEY_VERBS).toContain("look");
		expect(DEFAULT_KEY_VERBS).toContain("examine");
		expect(DEFAULT_KEY_VERBS).toContain("go");
		expect(DEFAULT_KEY_VERBS).toContain("open");
		expect(DEFAULT_KEY_VERBS).toContain("close");
		expect(DEFAULT_KEY_VERBS).toContain("inventory");
	});
});

describe("stripHighlight", () => {
	it("strips tags, markdown tags, and ANSI codes cleanly", () => {
		const tagged = "<item>brass lantern</item> is <exit>north</exit>, <verb>take</verb> it!";
		expect(stripHighlight(tagged)).toBe("brass lantern is north, take it!");

		const markdown = "[item:brass lantern] is [exit:north], [verb:take] it!";
		expect(stripHighlight(markdown)).toBe("brass lantern is north, take it!");

		const ansi = "\u001b[1;36mbrass lantern\u001b[0m is \u001b[1;32mnorth\u001b[0m!";
		expect(stripHighlight(ansi)).toBe("brass lantern is north!");
	});

	it("handles empty or plain string", () => {
		expect(stripHighlight("")).toBe("");
		expect(stripHighlight("plain text")).toBe("plain text");
	});
});
