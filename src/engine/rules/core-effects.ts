import type { EventBus } from "./event-bus";
import { executeAction } from "./executor";
import { PRIORITY } from "./priorities";

export function registerCoreEffects(bus: EventBus): void {
	// ── go: fire exit/enter sub-events ────────────────────────────────────

	bus.onGlobal(
		"after",
		"go",
		(event, state, world) => {
			const from = (event.params.from as string) ?? "";
			const to = (event.params.to as string) ?? "";

			const exitResult = executeAction(bus, world, state, "exit", {
				room: from,
			});
			let currentState = exitResult.state;
			event.feedback.push(...exitResult.feedback);

			const enterResult = executeAction(bus, world, currentState, "enter", {
				room: to,
			});
			currentState = enterResult.state;
			event.feedback.push(...enterResult.feedback);

			return currentState;
		},
		{ priority: PRIORITY.EFFECT },
	);
}
