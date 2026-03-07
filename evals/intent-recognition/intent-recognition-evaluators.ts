import type { IntentRecognitionEvalTarget, IntentRecognitionResult } from "../types";

function isActionAcceptable(action: string, target: IntentRecognitionEvalTarget): boolean {
	const acceptable = target.acceptableActions ?? [target.expectedAction];
	return acceptable.includes(action);
}

function isActionForbidden(action: string, target: IntentRecognitionEvalTarget): boolean {
	return (target.forbiddenActions ?? []).includes(action);
}

function normalizeString(value: unknown): string {
	return String(value).trim().toLowerCase();
}

function arraysMatch(expected: unknown[], produced: unknown[]): boolean {
	const a = expected.map(normalizeString).sort();
	const b = produced.map(normalizeString).sort();
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

function paramValuesMatch(expected: unknown, produced: unknown): boolean {
	if (expected === undefined || produced === undefined) return false;
	if (Array.isArray(expected) && Array.isArray(produced)) {
		return arraysMatch(expected, produced);
	}
	if (!Array.isArray(expected) && !Array.isArray(produced)) {
		return normalizeString(expected) === normalizeString(produced);
	}
	return false;
}

/**
 * Binary score: 1.0 if the correct action was selected, 0.0 otherwise.
 * Golden: exact match to expectedAction.
 * Secondary: action must be in acceptableActions (or expectedAction if not set).
 * Negative: 0 if action is in forbiddenActions, 1 otherwise.
 */
export function actionSelectionScore(output: IntentRecognitionResult, target?: IntentRecognitionEvalTarget): number {
	if (!target) return 0;
	if (target.category === "negative") {
		return isActionForbidden(output.action, target) ? 0 : 1;
	}
	if (target.category === "secondary") {
		return isActionAcceptable(output.action, target) ? 1 : 0;
	}
	return output.action === target.expectedAction ? 1 : 0;
}

/**
 * Key-by-key comparison of expected vs produced params.
 * Case-insensitive, trimmed string matching.
 * Score = matching keys / union of all keys.
 * Negative: not applied (returns 1). Secondary: only when action is acceptable.
 */
export function parameterAccuracyScore(output: IntentRecognitionResult, target?: IntentRecognitionEvalTarget): number {
	if (!target) return 0;
	if (target.category === "negative") return 1;
	if (target.category === "secondary" && !isActionAcceptable(output.action, target)) return 0;

	const expectedKeys = Object.keys(target.expectedParams);
	const producedKeys = Object.keys(output.params);
	const allKeys = Array.from(new Set([...expectedKeys, ...producedKeys]));

	// No expected params → don't penalize whatever the model produced (e.g. respond+message)
	if (expectedKeys.length === 0 && target.category === "secondary") return 1;

	if (allKeys.length === 0) return 1;

	let matches = 0;
	for (const key of allKeys) {
		if (paramValuesMatch(target.expectedParams[key], output.params[key])) {
			matches++;
		}
	}

	return matches / allKeys.length;
}

/**
 * Combined intent score: action correctness weighted 60%, param accuracy 40%.
 * If action is wrong, score is 0 regardless of params.
 * Negative: 0 if forbidden action selected, 1 otherwise (params not weighted).
 */
export function combinedIntentScore(output: IntentRecognitionResult, target?: IntentRecognitionEvalTarget): number {
	const actionScore = actionSelectionScore(output, target);
	if (actionScore === 0) return 0;
	if (target?.category === "negative") return 1;

	const paramScore = parameterAccuracyScore(output, target);
	return 0.6 * actionScore + 0.4 * paramScore;
}
