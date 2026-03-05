import { Text, type TextProps } from "ink";

export default function Texto(props: TextProps) {
	const { children, ...rest } = props;

	if (typeof children !== "string") {
		return <Text {...rest}>{children}</Text>;
	}

	const formatted = children.split(/(\*\*(?:.*?)\*\*)/).map((part, index) => {
		const key = `${index}-${part.slice(0, 10)}`;
		if (part.startsWith("**")) {
			return (
				<Text bold key={key} color="white">
					{part.replaceAll("**", "")}
				</Text>
			);
		}
		return <Text key={key}>{part}</Text>;
	});

	return <Text {...rest}>{formatted}</Text>;
}
