import { evaluate } from "@lmnr-ai/lmnr";
import dataset from "./data/intent-recognition.json" with { type: "json" };
import {
  actionSelectionScore,
  parameterAccuracyScore,
  combinedIntentScore,
} from "./structured-output-evaluators";
import { structuredOutputExecutor } from "./structured-output-executor";
import type {
  StructuredOutputEvalData,
  StructuredOutputEvalTarget,
  StructuredOutputResult,
  StructuredOutputDatasetEntry,
} from "./types";

evaluate<
  StructuredOutputEvalData,
  StructuredOutputEvalTarget,
  StructuredOutputResult
>({
  name: "structured-output-intent",
  data: dataset as StructuredOutputDatasetEntry[],
  executor: structuredOutputExecutor,
  evaluators: {
    actionSelection: (output, target) => {
      if (target?.category === "secondary") return 1;
      return actionSelectionScore(output, target);
    },
    parameterAccuracy: (output, target) => {
      if (target?.category === "secondary") return 1;
      return parameterAccuracyScore(output, target);
    },
    combined: (output, target) => {
      if (target?.category === "secondary") return 1;
      return combinedIntentScore(output, target);
    },
  },
  groupName: "intent-recognition",
});
