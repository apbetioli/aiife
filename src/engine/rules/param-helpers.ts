/**
 * All player-facing actions use `objects: string[]` for entity references.
 * Positional convention: objects[0] = target, objects[1] = instrument/indirect.
 */
export interface IntentParams {
	objects?: string[];
	[key: string]: unknown;
}

/** Full list of object IDs (trimmed, non-empty). */
export function getObjectIds(params: IntentParams): string[] {
	return (params.objects ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/** First object = target (most listeners only need this). */
export function getTarget(params: IntentParams): string {
	return getObjectIds(params)[0] ?? "";
}

/** Second object = instrument (key, weapon, etc.). */
export function getInstrument(params: IntentParams): string | undefined {
	return getObjectIds(params)[1];
}
