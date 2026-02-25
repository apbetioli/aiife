import type { StructuredOutputEvalTarget, StructuredOutputResult } from "./types";

/**
 * Binary score: 1.0 if the correct action was selected, 0.0 otherwise.
 * Directly comparable to the tool eval's toolSelectionScore.
 */
export function actionSelectionScore(
  output: StructuredOutputResult,
  target?: StructuredOutputEvalTarget
): number {
  if (!target) return 0;
  return output.action === target.expectedAction ? 1 : 0;
}

/**
 * Key-by-key comparison of expected vs produced params.
 * Case-insensitive, trimmed string matching.
 * Score = matching keys / union of all keys.
 */
export function parameterAccuracyScore(
  output: StructuredOutputResult,
  target?: StructuredOutputEvalTarget
): number {
  if (!target) return 0;

  const expectedKeys = Object.keys(target.expectedParams);
  const producedKeys = Object.keys(output.params);
  const allKeys = Array.from(new Set([...expectedKeys, ...producedKeys]));

  if (allKeys.length === 0) return 1;

  let matches = 0;
  for (const key of allKeys) {
    const expected = target.expectedParams[key];
    const produced = output.params[key];

    if (expected === undefined || produced === undefined) continue;

    const expStr = String(expected).trim().toLowerCase();
    const prodStr = String(produced).trim().toLowerCase();

    if (expStr === prodStr) matches++;
  }

  return matches / allKeys.length;
}

/**
 * Combined intent score: action correctness weighted 60%, param accuracy 40%.
 * If action is wrong, score is 0 regardless of params.
 */
export function combinedIntentScore(
  output: StructuredOutputResult,
  target?: StructuredOutputEvalTarget
): number {
  const actionScore = actionSelectionScore(output, target);
  if (actionScore === 0) return 0;

  const paramScore = parameterAccuracyScore(output, target);
  return 0.6 * actionScore + 0.4 * paramScore;
}
