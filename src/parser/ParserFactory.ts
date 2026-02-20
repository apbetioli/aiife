import { DEBUG } from "../debug.js";
import type { ParsedAction, Parser, ParserContext } from "../types.js";
import { AnthropicParser } from "./AnthropicParser.js";
import { RuleBasedParser } from "./RuleBasedParser.js";

/**
 * Tries the rule-based parser first; only calls the LLM when the rule-based
 * parser signals it couldn't understand the input (returns null from tryParse).
 * This keeps token usage minimal for all common commands.
 */
class HybridParser implements Parser {
  constructor(
    private readonly ruleParser: RuleBasedParser,
    private readonly llmParser: Parser
  ) {}

  async parseInput(
    input: string,
    context: ParserContext
  ): Promise<ParsedAction> {
    const result = this.ruleParser.tryParse(input);
    if (result !== null) {
      return result;
    }
    DEBUG(`[parser] rules couldn't parse "${input}", delegating to LLM…`);
    return this.llmParser.parseInput(input, context);
  }
}

export function createParser(): Parser {
  const ruleParser = new RuleBasedParser();
  const anthropic = new AnthropicParser();

  if (anthropic.isAvailable) {
    return new HybridParser(ruleParser, anthropic);
  }

  DEBUG("No ANTHROPIC_API_KEY found. Using rule-based parser only.");
  return ruleParser;
}
