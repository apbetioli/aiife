/**
 * Intent-shaped params: LLM may return target, items[], npc, indirect, instrument.
 * Helpers coalesce so listeners/guards can read a single "resolved" value.
 */
export interface IntentParams {
	target?: string | null;
	items?: string[] | null;
	npc?: string | null;
	indirect?: string | null;
	instrument?: string | null;
	direction?: string | null;
	from?: string | null;
	to?: string | null;
	[key: string]: unknown;
}

export function getTarget(params: IntentParams): string {
	return (
		(params.target ?? params.items?.[0] ?? params.npc ?? "") as string
	).trim() || "";
}

export function getIndirect(params: IntentParams): string | undefined {
	const v = params.indirect ?? params.items?.[0];
	return v != null && v !== "" ? String(v).trim() : undefined;
}

export function getInstrument(params: IntentParams): string | undefined {
	const v = params.instrument ?? params.items?.[0];
	return v != null && v !== "" ? String(v).trim() : undefined;
}
