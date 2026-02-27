// ─── Test with the Forgotten Manor ────────────────────────────────────────────

import theForgottenManor from "../../games/the-forgotten-manor";
import type { World } from "../world/types";
import { buildInitialState } from "./initial-state";

try {
	const state = buildInitialState(theForgottenManor as World);

	console.log("✅ Initial state built successfully!\n");
	console.log("── Player ──────────────────────────────");
	console.log(`   Room    : ${state.player.current_room}`);
	console.log(
		`   Inventory: [${state.player.inventory.join(", ") || "empty"}]`,
	);
	console.log(`   Moves   : ${state.player.state.moves}`);

	console.log("\n── Rooms ───────────────────────────────");
	for (const [id, room] of Object.entries(state.rooms)) {
		console.log(`   ${id}`);
		console.log(`     visited : ${room.visited}`);
		console.log(`     contains: [${room.contains.join(", ")}]`);
	}

	console.log("\n── Objects ─────────────────────────────");
	for (const [id, obj] of Object.entries(state.objects)) {
		const { location, contains, ...flags } = obj;
		const flagStr = Object.entries(flags)
			.map(([k, v]) => `${k}=${v}`)
			.join(", ");
		console.log(
			`   ${id.padEnd(16)} location=${location}${flagStr ? `  flags={${flagStr}}` : ""}${contains ? `  contains=[${contains.join(", ")}]` : ""}`,
		);
	}
} catch (err) {
	console.error("❌", (err as Error).message);
}
