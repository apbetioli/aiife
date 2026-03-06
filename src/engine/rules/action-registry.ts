import { z } from "zod";

function unknownActionError(actionName: string): z.ZodError {
	return new z.ZodError([{ code: "custom", message: `Unknown action: ${actionName}`, path: [] }]);
}

interface ActionEntry {
	schema: z.ZodType;
	description: string;
}

export class ActionRegistry {
	private actions = new Map<string, ActionEntry>();

	register(name: string, entry: { schema: z.ZodType; description: string }): void {
		this.actions.set(name, entry);
	}

	has(name: string): boolean {
		return this.actions.has(name);
	}

	names(): string[] {
		return [...this.actions.keys()];
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
}
