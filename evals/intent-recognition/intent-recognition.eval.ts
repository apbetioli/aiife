import { evaluate } from "@lmnr-ai/lmnr";
import { getEvalModelId } from "../../src/agent/model";
import type {
	IntentRecognitionDatasetEntry,
	IntentRecognitionEvalData,
	IntentRecognitionEvalTarget,
	IntentRecognitionResult,
} from "../types";
import drop from "./data/drop.json" with { type: "json" };
import examine from "./data/examine.json" with { type: "json" };
import go from "./data/go.json" with { type: "json" };
import help from "./data/help.json" with { type: "json" };
import inventory from "./data/inventory.json" with { type: "json" };
import look from "./data/look.json" with { type: "json" };
import open from "./data/open.json" with { type: "json" };
import respond from "./data/respond.json" with { type: "json" };
import take from "./data/take.json" with { type: "json" };
import talk from "./data/talk.json" with { type: "json" };
import use from "./data/use.json" with { type: "json" };
import zork from "./data/zork.json" with { type: "json" };
import { actionSelectionScore, combinedIntentScore, parameterAccuracyScore } from "./intent-recognition-evaluators";
import { toolIntentRecognitionExecutor } from "./tool-intent-recognition-executor";

const dataset = [
	...go,
	...look,
	...examine,
	...take,
	...drop,
	...use,
	...open,
	...talk,
	...inventory,
	...help,
	...respond,
	...zork,
] as IntentRecognitionDatasetEntry[];

const isScoped = process.env.EVAL_SCOPE_TOOLS !== "false";
const approachLabel = isScoped ? "scoped-tools" : "unscoped-tools";
const modelId = getEvalModelId();
const runName = process.env.EVAL_RUN_NAME ?? `${approachLabel} (${modelId})`;

console.log("Eval model:", modelId);
console.log("Eval approach:", approachLabel);
console.log("Eval run name:", runName);

evaluate<IntentRecognitionEvalData, IntentRecognitionEvalTarget, IntentRecognitionResult>({
	name: runName,
	data: dataset,
	executor: toolIntentRecognitionExecutor,
	evaluators: {
		actionSelection: actionSelectionScore,
		parameterAccuracy: parameterAccuracyScore,
		combined: combinedIntentScore,
	},
	groupName: "intent-recognition",
	metadata: {
		model: modelId,
		approach: approachLabel,
	},
});
