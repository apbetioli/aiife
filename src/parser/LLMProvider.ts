import type { Parser, ParsedAction, ParserContext } from "../types.js";
import { RuleBasedParser } from "./RuleBasedParser.js";
import { AnthropicProvider } from "./AnthropicProvider.js";

/**
 * Tries the rule-based parser first; only calls the LLM when the rule-based
 * parser signals it couldn't understand the input (returns null from tryParse).
 * This keeps token usage minimal for all common commands.
 */
class HybridParser implements Parser {
  constructor(
    private readonly ruleParser: RuleBasedParser,
    private readonly llmProvider: Parser
  ) {}

  async parseInput(
    input: string,
    context: ParserContext
  ): Promise<ParsedAction> {
    const result = this.ruleParser.tryParse(input);
    if (result !== null) {
      return result;
    }
    console.debug(
      `[parser] rules couldn't parse "${input}", delegating to LLM…`
    );
    return this.llmProvider.parseInput(input, context);
  }
}

export function createParser(): Parser {
  const ruleParser = new RuleBasedParser();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    console.log("Using hybrid parser (rules first, LLM fallback).");
    return new HybridParser(ruleParser, new AnthropicProvider(apiKey));
  }

  console.log("No ANTHROPIC_API_KEY found. Using rule-based parser only.");
  return ruleParser;
}
