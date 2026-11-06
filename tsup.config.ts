import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: { index: "src/index.ts" },
		format: ["esm"],
		dts: true,
		clean: true,
		sourcemap: true,
		target: "node20",
		banner: {
			js: "#!/usr/bin/env node",
		},
	},
	{
		entry: { sdk: "src/sdk.ts" },
		format: ["esm"],
		dts: true,
		sourcemap: true,
		target: "node20",
	},
]);
