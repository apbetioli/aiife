import type { LLMProvider } from "../types.js";
import { RuleBasedParser } from "./RuleBasedParser.js";
import { AnthropicProvider } from "./AnthropicProvider.js";

export function createParser(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    console.log("Using Anthropic LLM parser (Claude).");
    return new AnthropicProvider(apiKey);
  }

  console.log("No ANTHROPIC_API_KEY found. Using rule-based parser.");
  return new RuleBasedParser();
}
