import type { World } from "../../world/types";
import type { GameState } from "../types";
import { getTarget } from "./param-helpers";
import type {
	EventListener,
	EventName,
	EventPhase,
	GameEvent,
	ListenerRegistration,
} from "./types";

interface ListenerOptions {
	priority?: number;
	once?: boolean;
}

export class EventBus {
	private listeners: ListenerRegistration[] = [];

	on<N extends EventName>(reg: ListenerRegistration<N>): () => void {
		const r = reg as unknown as ListenerRegistration;
		this.listeners.push(r);
		return () => { // unsubscribe
			const idx = this.listeners.indexOf(r);
			if (idx >= 0) this.listeners.splice(idx, 1);
		};
	}

	onGlobal<N extends EventName>(
		phase: EventPhase,
		event: N,
		listener: EventListener<N>,
		options?: ListenerOptions,
	): () => void {
		return this.on<N>({
			scope: "global",
			event,
			phase,
			listener,
			priority: options?.priority ?? 100,
			once: options?.once ?? false,
		});
	}

	onRoom<N extends EventName>(
		phase: EventPhase,
		event: N,
		roomId: string,
		listener: EventListener<N>,
		options?: ListenerOptions,
	): () => void {
		return this.on<N>({
			scope: "room",
			scopeId: roomId,
			event,
			phase,
			listener,
			priority: options?.priority ?? 100,
			once: options?.once ?? false,
		});
	}

	onObject<N extends EventName>(
		phase: EventPhase,
		event: N,
		objectId: string,
		listener: EventListener<N>,
		options?: ListenerOptions,
	): () => void {
		return this.on<N>({
			scope: "object",
			scopeId: objectId,
			event,
			phase,
			listener,
			priority: options?.priority ?? 100,
			once: options?.once ?? false,
		});
	}

	emit<N extends EventName>(
		event: GameEvent<N>,
		world: World,
		state: GameState,
	): { state: GameState; event: GameEvent<N> } {
		const matching = this.listeners.filter((reg) => {
			if (reg.event !== event.name) return false;
			if (reg.phase !== event.phase) return false;
			return this.matchesScope(reg, event, state);
		});

		matching.sort((a, b) => a.priority - b.priority);

		let currentState = state;
		const toRemove: ListenerRegistration[] = [];

		for (const reg of matching) {
			if (event.cancelled) break;
			currentState = (reg.listener as EventListener<N>)(
				event,
				currentState,
				world,
			);
			if (reg.once) toRemove.push(reg);
		}

		for (const reg of toRemove) {
			const idx = this.listeners.indexOf(reg);
			if (idx >= 0) this.listeners.splice(idx, 1);
		}

		return { state: currentState, event };
	}

	private matchesScope<N extends EventName>(
		reg: ListenerRegistration,
		event: GameEvent<N>,
		state: GameState,
	): boolean {
		switch (reg.scope) {
			case "global":
				return true;
			case "room":
				return reg.scopeId === state.player.current_room;
			case "object":
				return getTarget(event.params as Parameters<typeof getTarget>[0]) === reg.scopeId;
			default:
				return false;
		}
	}
}
