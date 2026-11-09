import { z } from "zod";
import type { ParserContext } from "../../world/types";
import type { GameState } from "../types";
import type { ActionScopeRule, IntentMeta } from "./types";

function unknownActionError(actionName: string): z.ZodError {
	return new z.ZodError([{ code: "custom", message: `Unknown action: ${actionName}`, path: [] }]);
}

export interface ActionEntry {
	inputSchema: z.ZodType;
	/** @deprecated Use `inputSchema` instead. */
	schema: z.ZodType;
	description: string;
	aliases?: string[];
	hint?: string;
	scope?: ActionScopeRule;
}

export function evaluateActionScope(
	scope: ActionScopeRule | undefined,
	context: ParserContext,
	state?: GameState,
): boolean {
	if (!scope || scope === "always") return true;
	if (typeof scope === "function") return scope(context, state as GameState);

	if (scope.rooms) {
		const currentRoomId = state?.player?.current_room;
		const matches = currentRoomId
			? scope.rooms.includes(currentRoomId)
			: scope.rooms.some((r) => r === context.room || context.room.toLowerCase().includes(r.toLowerCase()));
		if (!matches) return false;
	}
	if (scope.objects && !context.in_scope_objects.some((o) => scope.objects?.includes(o.id))) {
		return false;
	}
	if (scope.types && !context.in_scope_objects.some((o) => scope.types?.includes(o.type))) {
		return false;
	}
	if (scope.when && state && !scope.when(context, state)) {
		return false;
	}

	return true;
}

export class ActionRegistry {
	private actions = new Map<string, ActionEntry>();

	register(name: string, entry: ActionEntry): void {
		this.actions.set(name, entry);
	}

	get(name: string): ActionEntry | undefined {
		return this.actions.get(name);
	}

	unregister(name: string): boolean {
		return this.actions.delete(name);
	}

	has(name: string): boolean {
		return this.actions.has(name);
	}

	names(): string[] {
		return [...this.actions.keys()];
	}

	/** Returns active action names matching the given parser context and game state. */
	getActiveActions(context: ParserContext, state?: GameState): string[] {
		const active: string[] = [];
		for (const [name, entry] of this.actions) {
			if (!entry.description) continue;
			if (evaluateActionScope(entry.scope, context, state)) {
				active.push(name);
			}
		}
		return active;
	}

	validate(name: string, params: unknown): z.infer<z.ZodType> {
		const entry = this.actions.get(name);
		if (!entry) throw new Error(`Unknown action: ${name}`);
		return entry.schema.parse(params);
	}

	safeParse(
		name: string,
		params: unknown,
	): { success: true; data: Record<string, unknown> } | { success: false; error: z.ZodError } {
		const entry = this.actions.get(name);
		if (!entry) return { success: false, error: unknownActionError(name) };
		return entry.schema.safeParse(params);
	}

	/** Returns name → description for entries with non-empty description (excludes internal events like tick, enter, exit). */
	getDescriptions(): Record<string, string> {
		return Object.fromEntries(
			[...this.actions].filter(([, entry]) => entry.description).map(([name, entry]) => [name, entry.description]),
		);
	}

	/** Returns name → intent metadata for entries with non-empty description. */
	getIntentMeta(): Record<string, IntentMeta> {
		return Object.fromEntries(
			[...this.actions]
				.filter(([, entry]) => entry.description)
				.map(([name, entry]) => [
					name,
					{
						description: entry.description,
						aliases: entry.aliases,
						hint: entry.hint,
					},
				]),
		);
	}
}
