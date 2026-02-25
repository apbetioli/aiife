import { type ModelMessage } from "ai";
import { AGENT_TOOL_SYSTEM_PROMPT } from "../src/agent/system/prompt";
import type { EvalData } from "./types";

/**
 * Build message array from eval data
 */
export const buildMessages = (data: EvalData): ModelMessage[] => {
  const systemPrompt = data.systemPrompt ?? AGENT_TOOL_SYSTEM_PROMPT;
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: data.prompt },
  ];
};
