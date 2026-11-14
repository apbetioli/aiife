import { Text as InkText, type TextProps as InkTextProps } from "ink";
import type { ReactNode } from "react";
import { highlightTutorialText, type TutorialHighlightContext } from "../../engine/tutorial-highlight";

export interface TextProps extends InkTextProps {
	tutorial?: boolean;
	tutorialContext?: TutorialHighlightContext;
	children?: ReactNode;
}

export function Text(props: TextProps) {
	const { children, tutorial, tutorialContext, ...rest } = props;

	if (typeof children !== "string") {
		return <InkText {...rest}>{children}</InkText>;
	}

	let textContent = children;
	if (tutorial && tutorialContext) {
		textContent = highlightTutorialText(textContent, tutorialContext, { format: "tags" });
	}

	// Tokenize tutorial tags, markdown tags, and markdown formatting:
	// <item>...</item>, <exit>...</exit>, <verb>...</verb>, [item:...], [exit:...], [verb:...], **bold**, *italic*, `code`
	const tokens = textContent.split(
		/(<item>[\s\S]*?<\/item>|<exit>[\s\S]*?<\/exit>|<verb>[\s\S]*?<\/verb>|\[item:[^\]]+\]|\[exit:[^\]]+\]|\[verb:[^\]]+\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/,
	);

	const formatted = tokens.map((part, index) => {
		const key = `token-${index}`;

		// Highlight interactable items: bold cyan
		if (part.startsWith("<item>") && part.endsWith("</item>")) {
			const content = part.slice(6, -7).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="cyan" key={key}>
					{content}
				</InkText>
			);
		}
		if (part.startsWith("[item:") && part.endsWith("]")) {
			const content = part.slice(6, -1).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="cyan" key={key}>
					{content}
				</InkText>
			);
		}

		// Highlight exits / directions: bold green
		if (part.startsWith("<exit>") && part.endsWith("</exit>")) {
			const content = part.slice(6, -7).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="green" key={key}>
					{content}
				</InkText>
			);
		}
		if (part.startsWith("[exit:") && part.endsWith("]")) {
			const content = part.slice(6, -1).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="green" key={key}>
					{content}
				</InkText>
			);
		}

		// Highlight key verbs: bold yellow
		if (part.startsWith("<verb>") && part.endsWith("</verb>")) {
			const content = part.slice(6, -7).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="yellow" key={key}>
					{content}
				</InkText>
			);
		}
		if (part.startsWith("[verb:") && part.endsWith("]")) {
			const content = part.slice(6, -1).replace(/^\*\*|\*\*$/g, "");
			return (
				<InkText bold color="yellow" key={key}>
					{content}
				</InkText>
			);
		}

		// Standard markdown
		if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
			return (
				<InkText bold key={key} color="white">
					{part.slice(2, -2)}
				</InkText>
			);
		}
		if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
			return (
				<InkText italic key={key}>
					{part.slice(1, -1)}
				</InkText>
			);
		}
		if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
			return (
				<InkText color="yellow" key={key}>
					{part.slice(1, -1)}
				</InkText>
			);
		}
		return <InkText key={key}>{part}</InkText>;
	});

	return <InkText {...rest}>{formatted}</InkText>;
}

export default Text;
