import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { DEBUG } from "../debug.js";
import type { ActionRegistry } from "../engine/ActionRegistry.js";
import type { ActionResult, GameAction, GameState } from "../types.js";
import {
  AGENT_TOOL_SYSTEM_PROMPT,
  buildGameStatePrompt,
  NARRATION_SYSTEM_PROMPT,
} from "./system/prompt.js";

export class GameAgent {
  private messages: ModelMessage[] = [];

  constructor(
    private state: GameState,
    private model: LanguageModel,
    private registry: ActionRegistry
  ) {}

  async processInput(playerInput: string): Promise<ActionResult> {
    this.messages.push({ role: "user", content: playerInput });

    let resultedInGameOver = false;
    let resultedInVictory = false;

    const tools = this.registry.getTools();

    // Phase 1: Force exactly one tool call so the model can't hallucinate
    // action results or chain multiple actions in a single turn.
    const actionResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: `${AGENT_TOOL_SYSTEM_PROMPT}\n\n${buildGameStatePrompt(
        this.state
      )}`,
      tools,
      toolChoice: "required",
      messages: this.messages,
    });

    this.messages.push(...(actionResponse.response.messages as ModelMessage[]));

    if (actionResponse.toolCalls.length === 0) {
      return { success: true, message: actionResponse.text };
    }

    for (const tc of actionResponse.toolCalls) {
      DEBUG(`Tool: ${JSON.stringify(tc.toolName)}`, JSON.stringify(tc.input));
      const params = tc.input as Record<string, unknown>;
      const result = this.registry.run(tc.toolName, params, this.state);

      if (result.gameOver) resultedInGameOver = true;
      if (result.isVictory) resultedInVictory = true;

      this.messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      });

      // Skip narration when the only action was respond — use its message as-is.
      if (actionResponse.toolCalls.length === 1 && tc.toolName === "respond") {
        return { success: true, message: result.message };
      }
    }

    // Phase 2: Narrate the tool result. No tools offered, so the model
    // can only produce text — it cannot chain another action.
    // Use NARRATION_SYSTEM_PROMPT so we don't pass updated state (e.g. after
    // a move the state is already the new room), which would confuse the
    // model into thinking the player "didn't move" or "was already there".
    const narrateResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: NARRATION_SYSTEM_PROMPT,
      messages: this.messages,
      toolChoice: "none",
    });

    this.messages.push({ role: "assistant", content: narrateResponse.text });

    return {
      success: true,
      message: narrateResponse.text,
      gameOver: resultedInGameOver || undefined,
      isVictory: resultedInVictory || undefined,
    };
  }

  async narrateResult(
    playerInput: string,
    action: GameAction,
    result: ActionResult
  ): Promise<ActionResult> {
    const toolCallId = `bypass_${Date.now()}`;

    this.messages.push(
      { role: "user", content: playerInput },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId,
            toolName: action.action,
            input: action.params,
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId,
            toolName: action.action,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      }
    );

    DEBUG("Exact action - bypass agent - narrate result", action.action);

    const narrateResponse = await generateText({
      model: this.model,
      maxOutputTokens: 1024,
      system: NARRATION_SYSTEM_PROMPT,
      messages: this.messages,
      toolChoice: "none",
    });

    const text = narrateResponse.text || result.message;
    this.messages.push({ role: "assistant", content: text });

    return { ...result, message: text };
  }
}
