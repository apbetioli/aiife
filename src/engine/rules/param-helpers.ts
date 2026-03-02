import type { StructuredOutput } from "../../agent/types";

/**
 * Intent-shaped params: LLM may return target, objects[], actor, indirect, instrument.
 * Helpers coalesce so listeners/guards can read a single "resolved" value.
 */
export type IntentParams = Partial<StructuredOutput> & {
	indirect?: string | null;
	instrument?: string | null;
	[key: string]: unknown;
};

interface ResolvedParams {
	target: string;
	instrument?: string;
	indirect?: string;
}

/**
 * Resolve all intent params in one pass, consuming objects sequentially
 * so each value is used at most once.
 */
export function resolveParams(params: IntentParams): ResolvedParams {
	const objects = [...(params.objects ?? [])];

	const target =
		params.target?.trim() ?? params.actor?.trim() ?? objects.shift()?.trim() ?? "";
	const instrument = params.instrument?.trim() ?? objects.shift()?.trim();
	const indirect = params.indirect?.trim() ?? objects.shift()?.trim();

	return { target, instrument, indirect };
}

/** Shorthand — most listeners only need the target. */
export function getTarget(params: IntentParams): string {
	return resolveParams(params).target;
}

/** Resolve the instrument (key, weapon, etc.) without colliding with target. */
export function getInstrument(params: IntentParams): string | undefined {
	return resolveParams(params).instrument;
}
