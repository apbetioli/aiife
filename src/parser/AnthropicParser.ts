import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEBUG } from "../debug.js";
import type { ParsedAction, Parser, ParserContext } from "../types.js";
import { ACTION_TYPES, DIRECTIONS } from "../types.js";

const ParsedActionSchema = z.object({
  actionType: z.enum(ACTION_TYPES),
  target: z
    .string()
    .nullish()
    .transform((x) => x ?? undefined),
  secondaryTarget: z
    .string()
    .nullish()
    .transform((x) => x ?? undefined),
  direction: z
    .enum(DIRECTIONS)
    .nullish()
    .transform((x) => x ?? undefined),
});

export class AnthropicParser implements Parser {
  private client: Anthropic | null;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  async parseInput(
    input: string,
    context: ParserContext
  ): Promise<ParsedAction> {
    if (!this.client) {
      throw new Error("No ANTHROPIC_API_KEY configured.");
    }

    const systemPrompt = `You are a parser for a text adventure game. Your job is to interpret the player's natural language input and map it to a structured game action.

You must return a JSON object with these fields:
- actionType: one of ${ACTION_TYPES.join(", ")}
- target: the primary object/entity being acted on (use simple names like "key", "chest", "gardener", "alcove")
- secondaryTarget: for "use X on Y" actions, this is Y (e.g., "door", "pedestal")
- direction: for move actions, one of ${DIRECTIONS.join(", ")}

Rules:
- Only use the action types listed above
- For movement, always set direction and actionType to "move"
- For "use X on Y", set target to X and secondaryTarget to Y
- Keep target names simple and lowercase
- If the player wants to look around, use "look" with no target
- If they want to look at something specific, use "examine" with a target
- "talk" is for speaking with NPCs
- "open" is for opening containers or doors`;

    const userPrompt = `Current room: ${context.roomName}
Room description: ${context.roomDescription}
Exits: ${context.exits.join(", ") || "none"}
Visible items: ${context.visibleItems.join(", ") || "none"}
NPCs present: ${context.npcs.join(", ") || "none"}
Inventory: ${context.inventory.join(", ") || "empty"}

Player input: "${input}"

Return the parsed action as JSON.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from LLM");
    }

    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const validated = ParsedActionSchema.parse(parsed);
    DEBUG("LLM parsed action:", validated);

    return {
      ...validated,
      rawInput: input,
    };
  }
}
