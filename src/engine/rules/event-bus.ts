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
} from "./types";

interface ListenerOptions {
	priority?: number;
	once?: boolean;
}

export interface EmitResult {
	state: GameState;
	feedback: string[];
	cancelled: boolean;
}

export class EventBus {
	private listeners: ListenerRegistration[] = [];

	// Global: on(event, listener, opts?)
	on<N extends EventName>(
		event: N,
		listener: EventListener<N>,
		options?: ListenerOptions,
	): () => void;
	// Scoped: on(event, scopeId, listener, opts?)
	on<N extends EventName>(
		event: N,
		scopeId: string,
		listener: EventListener<N>,
		options?: ListenerOptions,
	): () => void;
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

		const reg: ListenerRegistration<N> = {
			scope,
			scopeId,
			event,
			listener,
			priority: options?.priority ?? PRIORITY.MUTATION,
			once: options?.once ?? false,
		};

		const r = reg as unknown as ListenerRegistration;
		this.listeners.push(r);
		return () => {
			const idx = this.listeners.indexOf(r);
			if (idx >= 0) this.listeners.splice(idx, 1);
		};
	}

	emit<N extends EventName>(
		event: GameEvent<N>,
		world: World,
		state: GameState,
	): EmitResult {
		// Find all listeners for this event
		const matching = this.listeners.filter((reg) => reg.event === event.name);

		// Group by priority
		const byPriority = new Map<number, ListenerRegistration[]>();
		for (const reg of matching) {
			let group = byPriority.get(reg.priority);
			if (!group) {
				group = [];
				byPriority.set(reg.priority, group);
			}
			group.push(reg);
		}

		const priorities = [...byPriority.keys()].sort((a, b) => a - b);

		let currentState = state;
		const feedback: string[] = [];
		let cancelled = false;
		const toRemove: ListenerRegistration[] = [];

		for (const priority of priorities) {
			if (cancelled) break;

			const group = byPriority.get(priority)!;

			// Find scoped listener that matches current context
			const scopedMatch = group.find(
				(reg) =>
					reg.scope === "scoped" && this.matchesScope(reg, event, currentState),
			);

			// Pick scoped if it exists, otherwise global
			const chosen = scopedMatch ?? group.find((reg) => reg.scope === "global");

			if (!chosen) continue;

			const raw = (chosen.listener as EventListener<N>)(
				event,
				currentState,
				world,
			);
			const result = this.normalizeResult(raw);

			currentState = result.state;
			if (result.feedback) feedback.push(...result.feedback);

			if (result.cancel) {
				cancelled = true;
				feedback.push(result.cancel);
			}

			if (chosen.once) toRemove.push(chosen);
		}

		for (const reg of toRemove) {
			const idx = this.listeners.indexOf(reg);
			if (idx >= 0) this.listeners.splice(idx, 1);
		}

		return { state: currentState, feedback, cancelled };
	}

	private matchesScope<N extends EventName>(
		reg: ListenerRegistration,
		event: GameEvent<N>,
		state: GameState,
	): boolean {
		if (reg.scope !== "scoped" || !reg.scopeId) return false;
		// Match by room or by object target
		if (reg.scopeId === state.player.current_room) return true;
		return (
			getTarget(event.params as Parameters<typeof getTarget>[0]) === reg.scopeId
		);
	}

	private normalizeResult(raw: ListenerResult | GameState): ListenerResult {
		// GameState always has `player`; ListenerResult never does
		if ("player" in raw) return { state: raw as GameState };
		return raw as ListenerResult;
	}
}
