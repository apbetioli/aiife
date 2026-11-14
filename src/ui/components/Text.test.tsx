import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { MessageList } from "./MessageList";
import { Text } from "./Text";

describe("Text component highlighting", () => {
	it("renders plain text without tags as single element", () => {
		const element = Text({ children: "Hello world" });
		expect(element).toBeDefined();
		const children = element.props.children;
		expect(Array.isArray(children)).toBe(true);
		expect(children[0].props.children).toBe("Hello world");
	});

	it("renders <item> tag with cyan bold formatting", () => {
		const element = Text({ children: "You see a <item>brass lantern</item> here." });
		const children = element.props.children as ReactElement[];

		// Find the item element
		const itemEl = children.find((c) => c.props.children === "brass lantern");
		expect(itemEl).toBeDefined();
		expect(itemEl?.props.color).toBe("cyan");
		expect(itemEl?.props.bold).toBe(true);
	});

	it("renders [item:...] markdown tag with cyan bold formatting", () => {
		const element = Text({ children: "You see a [item:brass lantern] here." });
		const children = element.props.children as ReactElement[];

		const itemEl = children.find((c) => c.props.children === "brass lantern");
		expect(itemEl).toBeDefined();
		expect(itemEl?.props.color).toBe("cyan");
		expect(itemEl?.props.bold).toBe(true);
	});

	it("renders <exit> tag with green bold formatting", () => {
		const element = Text({ children: "Exits lead <exit>north</exit> and <exit>east</exit>." });
		const children = element.props.children as ReactElement[];

		const northEl = children.find((c) => c.props.children === "north");
		expect(northEl).toBeDefined();
		expect(northEl?.props.color).toBe("green");
		expect(northEl?.props.bold).toBe(true);

		const eastEl = children.find((c) => c.props.children === "east");
		expect(eastEl).toBeDefined();
		expect(eastEl?.props.color).toBe("green");
		expect(eastEl?.props.bold).toBe(true);
	});

	it("renders [exit:...] markdown tag with green bold formatting", () => {
		const element = Text({ children: "Exits lead [exit:north] and [exit:east]." });
		const children = element.props.children as ReactElement[];

		const northEl = children.find((c) => c.props.children === "north");
		expect(northEl).toBeDefined();
		expect(northEl?.props.color).toBe("green");
		expect(northEl?.props.bold).toBe(true);
	});

	it("renders <verb> tag with yellow bold formatting", () => {
		const element = Text({ children: "You can <verb>take</verb> the item." });
		const children = element.props.children as ReactElement[];

		const verbEl = children.find((c) => c.props.children === "take");
		expect(verbEl).toBeDefined();
		expect(verbEl?.props.color).toBe("yellow");
		expect(verbEl?.props.bold).toBe(true);
	});

	it("renders [verb:...] markdown tag with yellow bold formatting", () => {
		const element = Text({ children: "You can [verb:take] the item." });
		const children = element.props.children as ReactElement[];

		const verbEl = children.find((c) => c.props.children === "take");
		expect(verbEl).toBeDefined();
		expect(verbEl?.props.color).toBe("yellow");
		expect(verbEl?.props.bold).toBe(true);
	});

	it("highlights automatically when tutorial and tutorialContext props are supplied", () => {
		const element = Text({
			children: "A brass lantern is to the north. You can take it.",
			tutorial: true,
			tutorialContext: {
				objects: ["brass lantern"],
				exits: ["north"],
				verbs: ["take"],
			},
		});
		const children = element.props.children as ReactElement[];

		const itemEl = children.find((c) => c.props.children === "brass lantern");
		expect(itemEl).toBeDefined();
		expect(itemEl?.props.color).toBe("cyan");
		expect(itemEl?.props.bold).toBe(true);

		const exitEl = children.find((c) => c.props.children === "north");
		expect(exitEl).toBeDefined();
		expect(exitEl?.props.color).toBe("green");
		expect(exitEl?.props.bold).toBe(true);

		const verbEl = children.find((c) => c.props.children === "take");
		expect(verbEl).toBeDefined();
		expect(verbEl?.props.color).toBe("yellow");
		expect(verbEl?.props.bold).toBe(true);
	});

	it("MessageList accepts tutorial and tutorialContext props cleanly", () => {
		const list = MessageList({
			messages: [{ role: "assistant", content: "Go north" }],
			tutorial: true,
			tutorialContext: {
				exits: ["north"],
			},
		});
		expect(list).toBeDefined();
	});
});
