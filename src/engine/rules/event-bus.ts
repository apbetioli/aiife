import type { World } from "../../world/types";
import type { GameState } from "../types";
import { getTarget } from "./param-helpers";
import { PRIORITY } from "./priorities";
import type {
	EventListener,
	EventName,
	GameEvent,
	ListenerRegistration,
	ListenerResult,
	StoppableEvent,
} from "./types";

interface ListenerOptions {
	priority?: number;
	once?: boolean;
}

export interface EmitResult {
	state: GameState;
	feedback: string[];
	stopped: boolean;
}

function groupListenersByPriority(
	listeners: ListenerRegistration[],
	eventName: EventName,
): Map<number, ListenerRegistration[]> {
	const byPriority = new Map<number, ListenerRegistration[]>();

	for (const registration of listeners) {
		if (registration.event !== eventName) continue;

		let group = byPriority.get(registration.priority);
		if (!group) {
			group = [];
			byPriority.set(registration.priority, group);
		}

		group.push(registration);
	}

	return byPriority;
}

export class EventBus {
	private listeners: ListenerRegistration[] = [];

	private unregister(registration: ListenerRegistration): void {
		const index = this.listeners.indexOf(registration);
		if (index >= 0) {
			this.listeners.splice(index, 1);
		}
	}

	// Global: on(event, listener, opts?)
	on<N extends EventName>(event: N, listener: EventListener<N>, options?: ListenerOptions): () => void;
	// Scoped: on(event, scopeId, listener, opts?)
	on<N extends EventName>(event: N, scopeId: string, listener: EventListener<N>, options?: ListenerOptions): () => void;
	on<N extends EventName>(
		event: N,
		listenerOrScopeId: EventListener<N> | string,
		listenerOrOptions?: EventListener<N> | ListenerOptions,
		maybeOptions?: ListenerOptions,
	): () => void {
		let scope: "global" | "scoped";
		let scopeId: string | undefined;
		let listener: EventListener<N>;
		let options: ListenerOptions | undefined;

		if (typeof listenerOrScopeId === "function") {
			// Global overload
			scope = "global";
			listener = listenerOrScopeId;
			options = listenerOrOptions as ListenerOptions | undefined;
		} else {
			// Scoped overload
			scope = "scoped";
			scopeId = listenerOrScopeId;
			listener = listenerOrOptions as EventListener<N>;
			options = maybeOptions;
		}

		const registration: ListenerRegistration<N> = {
			scope,
			scopeId,
			event,
			listener,
			priority: options?.priority ?? PRIORITY.MUTATION,
			once: options?.once ?? false,
		};

		const storedRegistration = registration as unknown as ListenerRegistration;
		this.listeners.push(storedRegistration);
		return () => {
			this.unregister(storedRegistration);
		};
	}

	/**
	 * Emit an event to all registered listeners.
	 *
	 * - Listeners run by ascending priority (lower runs first).
	 * - Within a priority, global listeners run in registration order. When a
	 *   scoped listener matches the current context, only that listener runs
	 *   (no other listeners at that priority).
	 * - Call event.stop(message) to stop propagation; the message is added to feedback.
	 */
	emit<N extends EventName>(event: GameEvent<N>, world: World, state: GameState): EmitResult {
		const listenersByPriority = groupListenersByPriority(this.listeners, event.name);
		const priorities = [...listenersByPriority.keys()].sort((a, b) => a - b);

		let currentState = state;
		const feedback: string[] = [];
		let stopped = false;
		const toRemove: ListenerRegistration[] = [];

		const stoppable: StoppableEvent<N> = Object.assign(Object.create(event), {
			stop(message?: string | string[]) {
				stopped = true;
				if (message !== undefined) {
					feedback.push(...(Array.isArray(message) ? message : [message]));
				}
			},
		});

		for (const priority of priorities) {
			if (stopped) break;

			const group = listenersByPriority.get(priority);
			if (!group) continue;

			// Find scoped listener that matches current context
			const scopedMatch = group.find(
				(registration) => registration.scope === "scoped" && this.matchesScope(registration, event, currentState),
			);

			// Run either the single scoped match or all global listeners at this priority
			const toRun = scopedMatch ? [scopedMatch] : group.filter((r) => r.scope === "global");

			for (const chosen of toRun) {
				if (stopped) break;

				const raw = (chosen.listener as EventListener<N>)(stoppable, currentState, world);
				const result = this.normalizeResult(raw);

				currentState = result.state;
				if (result.feedback) feedback.push(...result.feedback);

				if (chosen.once) toRemove.push(chosen);
			}
		}

		for (const reg of toRemove) {
			const idx = this.listeners.indexOf(reg);
			if (idx >= 0) this.listeners.splice(idx, 1);
		}

		return { state: currentState, feedback, stopped };
	}

	private matchesScope<N extends EventName>(reg: ListenerRegistration, event: GameEvent<N>, state: GameState): boolean {
		if (reg.scope !== "scoped" || !reg.scopeId) return false;
		// Match by room or by object target
		if (reg.scopeId === state.player.current_room) return true;
		return getTarget(event.params as Parameters<typeof getTarget>[0]) === reg.scopeId;
	}

	private normalizeResult(raw: ListenerResult | GameState): ListenerResult {
		// GameState always has `player`; ListenerResult never does
		if ("player" in raw) return { state: raw as GameState };
		return raw as ListenerResult;
	}
}
