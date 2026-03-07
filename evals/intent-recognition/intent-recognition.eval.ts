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
import { actionSelectionScore, combinedIntentScore, parameterAccuracyScore } from "./intent-recognition-evaluators";
import { intentRecognitionExecutor } from "./intent-recognition-executor";

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
] as IntentRecognitionDatasetEntry[];

console.log("Eval model:", getEvalModelId());

evaluate<IntentRecognitionEvalData, IntentRecognitionEvalTarget, IntentRecognitionResult>({
	data: dataset,
	executor: intentRecognitionExecutor,
	evaluators: {
		actionSelection: actionSelectionScore,
		parameterAccuracy: parameterAccuracyScore,
		combined: combinedIntentScore,
	},
	groupName: "intent-recognition",
	metadata: { model: getEvalModelId() },
});
