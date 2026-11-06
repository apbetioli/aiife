import { Text as InkText, type TextProps } from "ink";

export function Text(props: TextProps) {
	const { children, ...rest } = props;

	if (typeof children !== "string") {
		return <InkText {...rest}>{children}</InkText>;
	}

	// Tokenize markdown formatting: **bold**, *italic*, `code`
	const tokens = children.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);

	const formatted = tokens.map((part, index) => {
		const key = `token-${index}`;
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
