import { evaluate } from "@lmnr-ai/lmnr";
import dataset from "./data/move-tool.json" with { type: "json" };
import { toolSelectionScore } from "./tool-agent-evaluators";
import { singleTurnExecutorWithMocks } from "./tool-agent-executor";
import type { EvalData, EvalTarget, SingleTurnDatasetEntry, SingleTurnResult } from "./types";

const executor = async (data: EvalData) => {
    return singleTurnExecutorWithMocks(data);
};

// This is an experiment
evaluate<EvalData, EvalTarget, SingleTurnResult>({
    name: process.env.EVAL_MODEL
        ? `move-tool-selection-${process.env.EVAL_MODEL}`
        : "move-tool-selection",
    data: dataset as SingleTurnDatasetEntry[],
    executor,
    evaluators: {

        selectionScore: (output, target) => {
            // Don't penalize secondary prompts, but reward them if they succeed.
            // This prevents evaluation scores from being diminished by scenarios outside the agent's core intended functionality.
            // They could be filtered in the dataset?
            if(target?.category === "secondary") return 1

            return toolSelectionScore(output, target);
        }
    },
    groupName: "move-tool-selection", // Group experiments together for comparison
})