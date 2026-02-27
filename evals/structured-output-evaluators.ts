import type {
	StructuredOutputEvalTarget,
	StructuredOutputResult,
} from "./types";

function isActionAcceptable(
	action: string,
	target: StructuredOutputEvalTarget,
): boolean {
	const acceptable = target.acceptableActions ?? [target.expectedAction];
	return acceptable.includes(action);
}

function isActionForbidden(
	action: string,
	target: StructuredOutputEvalTarget,
): boolean {
	return (target.forbiddenActions ?? []).includes(action);
}

/**
 * Binary score: 1.0 if the correct action was selected, 0.0 otherwise.
 * Golden: exact match to expectedAction.
 * Secondary: action must be in acceptableActions (or expectedAction if not set).
 * Negative: 0 if action is in forbiddenActions, 1 otherwise.
 */
export function actionSelectionScore(
	output: StructuredOutputResult,
	target?: StructuredOutputEvalTarget,
): number {
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
export function parameterAccuracyScore(
	output: StructuredOutputResult,
	target?: StructuredOutputEvalTarget,
): number {
	if (!target) return 0;
	if (target.category === "negative") return 1;
	if (
		target.category === "secondary" &&
		!isActionAcceptable(output.action, target)
	)
		return 0;

	const expectedKeys = Object.keys(target.expectedParams);
	const producedKeys = Object.keys(output.params);
	const allKeys = Array.from(new Set([...expectedKeys, ...producedKeys]));

	if (allKeys.length === 0) return 1;

	let matches = 0;
	for (const key of allKeys) {
		const expected = target.expectedParams[key];
		const produced = output.params[key];

		if (expected === undefined || produced === undefined) continue;

		// Both arrays — normalize (lowercase, sort) and compare element-wise
		if (Array.isArray(expected) && Array.isArray(produced)) {
			const expArr = expected.map((e: unknown) =>
				String(e).trim().toLowerCase(),
			);
			const prodArr = produced.map((p: unknown) =>
				String(p).trim().toLowerCase(),
			);
			expArr.sort();
			prodArr.sort();
			if (
				expArr.length === prodArr.length &&
				expArr.every((v: string, i: number) => v === prodArr[i])
			) {
				matches++;
			}
			continue;
		}

		// Both scalars — existing string comparison
		if (!Array.isArray(expected) && !Array.isArray(produced)) {
			const expStr = String(expected).trim().toLowerCase();
			const prodStr = String(produced).trim().toLowerCase();
			if (expStr === prodStr) matches++;
		}
		// Mismatched types (one array, one scalar) — no match
	}

	return matches / allKeys.length;
}

/**
 * Combined intent score: action correctness weighted 60%, param accuracy 40%.
 * If action is wrong, score is 0 regardless of params.
 * Negative: 0 if forbidden action selected, 1 otherwise (params not weighted).
 */
export function combinedIntentScore(
	output: StructuredOutputResult,
	target?: StructuredOutputEvalTarget,
): number {
	const actionScore = actionSelectionScore(output, target);
	if (actionScore === 0) return 0;
	if (target?.category === "negative") return 1;

	const paramScore = parameterAccuracyScore(output, target);
	return 0.6 * actionScore + 0.4 * paramScore;
}
