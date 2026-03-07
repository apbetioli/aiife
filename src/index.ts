import { render } from "ink";
import React from "react";
import { getModelsDebugInfo } from "./agent/model";
import { App } from "./ui";
import { loadWorld } from "./world/world-loader";

async function main() {
	if (process.env.DEBUG === "true") {
		console.log(`Models:\n${getModelsDebugInfo()}`);
	}

	const { world, setup } = await loadWorld();

	render(React.createElement(App, { world, setup }));
}

main();
