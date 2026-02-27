import { evaluate } from "@lmnr-ai/lmnr";
import type { StructuredOutputResult } from "../src/agent/types";
import drop from "./data/intent-recognition/drop.json" with { type: "json" };
import examine from "./data/intent-recognition/examine.json" with {
	type: "json",
};
import go from "./data/intent-recognition/go.json" with { type: "json" };
import help from "./data/intent-recognition/help.json" with { type: "json" };
import inventory from "./data/intent-recognition/inventory.json" with {
	type: "json",
};
import look from "./data/intent-recognition/look.json" with { type: "json" };
import open from "./data/intent-recognition/open.json" with { type: "json" };
import respond from "./data/intent-recognition/respond.json" with {
	type: "json",
};
import take from "./data/intent-recognition/take.json" with { type: "json" };
import talk from "./data/intent-recognition/talk.json" with { type: "json" };
import use from "./data/intent-recognition/use.json" with { type: "json" };
import {
	actionSelectionScore,
	combinedIntentScore,
	parameterAccuracyScore,
} from "./structured-output-evaluators";
import { structuredOutputExecutor } from "./structured-output-executor";
import type {
	StructuredOutputDatasetEntry,
	StructuredOutputEvalData,
	StructuredOutputEvalTarget,
} from "./types";

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
] as StructuredOutputDatasetEntry[];

evaluate<
	StructuredOutputEvalData,
	StructuredOutputEvalTarget,
	StructuredOutputResult
>({
	name: process.env.EVAL_MODEL
		? `structured-output-intent-${process.env.EVAL_MODEL}`
		: "structured-output-intent",
	data: dataset,
	executor: structuredOutputExecutor,
	evaluators: {
		actionSelection: actionSelectionScore,
		parameterAccuracy: parameterAccuracyScore,
		combined: combinedIntentScore,
	},
	groupName: "intent-recognition",
});
