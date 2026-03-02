import type { StructuredOutput } from "../../agent/types";

/**
 * Intent-shaped params: LLM may return target, items[], npc, indirect, instrument.
 * Helpers coalesce so listeners/guards can read a single "resolved" value.
 */
export type IntentParams = Partial<StructuredOutput> & {
	indirect?: string | null;
	instrument?: string | null;
	[key: string]: unknown;
};

export function getTarget(params: IntentParams): string {
	const target = params.target ?? params.items?.[0] ?? params.npc;
	return target?.trim() ?? "";
}

export function getIndirect(params: IntentParams): string | undefined {
	const v = params.indirect ?? params.items?.[0];
	return v?.trim();
}

export function getInstrument(params: IntentParams): string | undefined {
	const v = params.instrument ?? params.items?.[0];
	return v?.trim();
}
