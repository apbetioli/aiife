import type { World } from "../../world/types";
import { immutable } from "../mutators";
import type { GameState } from "../types";
import { getTarget } from "./param-helpers";
import { PRIORITY } from "./priorities";
import type {
	EventListener,
	EventListenerResult,
	EventName,
	GameEvent,
	ListenerRegistration,
	Observer,
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

function groupListenersByPriority(listeners: Iterable<ListenerRegistration>): Map<number, ListenerRegistration[]> {
	const byPriority = new Map<number, ListenerRegistration[]>();

	for (const registration of listeners) {
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
	private listeners = new Map<EventName, Set<ListenerRegistration>>();
	private observers = new Set<Observer>();

	addObserver(observer: Observer): void {
		this.observers.add(observer);
	}

	private notifyObservers(event: GameEvent, result?: EventListenerResult): void {
		for (const observer of this.observers) {
			observer(event, result);
		}
	}

	/**
	 * Register a global listener for an event.
	 */
	on<N extends EventName>(event: N, listener: EventListener<N>, options?: ListenerOptions): () => void;
	/**
	 * Register a scoped listener for an event matching a specific object or room scopeId.
	 *
	 * Note: Within a priority band, a matching scoped listener preempts all global listeners
	 * at that same priority.
	 * - Use `priority: PRIORITY.GUARD` (50) for checks and conditional action cancellation.
	 * - Use `priority: PRIORITY.EFFECT` (150) or `PRIORITY.POST_MUTATION` (110) for custom reactions.
	 * - Only use default `PRIORITY.MUTATION` (100) if explicitly intending to replace the core mutation.
	 */
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
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(storedRegistration);

		return () => {
			set.delete(storedRegistration);
			if (set.size === 0) {
				this.listeners.delete(event);
			}
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
	emit<N extends EventName>(event: GameEvent<N>, world: World, currentState: GameState): EmitResult {
		const eventListeners = this.listeners.get(event.name);
		const listenersByPriority = eventListeners
			? groupListenersByPriority(eventListeners)
			: new Map<number, ListenerRegistration[]>();
		const priorities = [...listenersByPriority.keys()].sort((a, b) => a - b);
		const toRemove: ListenerRegistration[] = [];

		const stoppable: StoppableEvent<N> = Object.assign(Object.create(event), {
			stop() {
				stopped = true;
			},
		});

		this.notifyObservers(stoppable);

		const feedback: string[] = [];
		let stopped = false;

		const nextState = immutable(currentState, (state) => {
			for (const priority of priorities) {
				if (stopped) break;

				const group = listenersByPriority.get(priority);
				if (!group) continue;

				// Find scoped listener that matches current context
				const scopedMatch = group.find(
					(registration) => registration.scope === "scoped" && this.matchesScope(registration, event, state),
				);

				// Run either the single scoped match or all global listeners at this priority
				const toRun = scopedMatch ? [scopedMatch] : group.filter((r) => r.scope === "global");

				for (const chosen of toRun) {
					if (stopped) break;

					const result = (chosen.listener as EventListener<N>)(stoppable, state, world);

					if (result !== undefined) {
						if (typeof result === "string") {
							feedback.push(result);
						} else if (Array.isArray(result)) {
							feedback.push(...result);
						}
					}

					if (chosen.once) toRemove.push(chosen);
				}
			}
		});

		for (const reg of toRemove) {
			const set = this.listeners.get(reg.event);
			if (set) {
				set.delete(reg);
				if (set.size === 0) {
					this.listeners.delete(reg.event);
				}
			}
		}

		return { state: nextState, feedback, stopped };
	}

	private matchesScope<N extends EventName>(reg: ListenerRegistration, event: GameEvent<N>, state: GameState): boolean {
		if (reg.scope !== "scoped" || !reg.scopeId) return false;
		// Match by room or by object target
		if (reg.scopeId === state.player.current_room) return true;
		return getTarget(event.params as Parameters<typeof getTarget>[0]) === reg.scopeId;
	}
}
