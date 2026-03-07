import type { World } from "../../world/types";
import type { GameState } from "../types";
import type { EventBus } from "./event-bus";
import { PRIORITY } from "./priorities";

// ─── Daemon ──────────────────────────────────────────────────────────────────

interface DaemonOptions {
	condition: (world: World, state: GameState) => boolean;
	effect: (world: World, state: GameState) => void;
	priority?: number;
	feedback?: (world: World, state: GameState) => string | undefined;
}

/**
 * Register a global tick listener that checks a condition each turn
 * and applies an effect when met.
 */
export function registerDaemon(bus: EventBus, _name: string, options: DaemonOptions): () => void {
	return bus.on(
		"tick",
		(_event, state, world) => {
			if (!options.condition(world, state)) return;
			options.effect(world, state);
			const msg = options.feedback?.(world, state);
			return msg !== undefined ? [msg] : undefined;
		},
		{ priority: options.priority ?? PRIORITY.DAEMON },
	);
}
