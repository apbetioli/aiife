import { render } from "ink";
import React from "react";
import { getModelsDebugInfo } from "./agent/model";
import { App } from "./ui";
import { IS_DEBUG } from "./ui/helpers";
import { loadWorld } from "./world/world-loader";

async function main() {
	if (IS_DEBUG) {
		console.log(`Models:\n${getModelsDebugInfo()}\n`);
	}

	const { world, setup } = await loadWorld();

	render(React.createElement(App, { world, setup }));
}

main();
