# Evaluating model performance

This guide shows you how to benchmark intent recognition accuracy, latency, and token consumption using the Laminar evaluation pipeline.

---

## Compare model accuracy and latency

To benchmark different language models against the intent evaluation dataset:

1. Set your Laminar project key:
   ```bash
   export LMNR_PROJECT_API_KEY=<your_key>
   ```

2. Run the evaluation suite with your primary model:
   ```bash
   EVAL_MODEL=gpt-4o npm run eval
   ```

3. Run the evaluation suite with a comparison model:
   ```bash
   EVAL_MODEL=gpt-4o-mini npm run eval
   ```

Both runs publish to the same Laminar group (`intent-recognition`). Open the Laminar dashboard to compare:
- **Accuracy scores.** Inspect `actionSelection` and `parameterAccuracy` to compare recognition rates.
- **Latency and token usage.** Inspect traces to evaluate execution time and token consumption per turn.

To override model parameters on specific test cases, set `data.config.model` and `data.config.temperature` directly in the dataset JSON. The environment variable `EVAL_MODEL` overrides dataset-level model choices when set.

---

## Compare prompt baselines to scoped tools

To compare the monolithic prompt baseline against dynamic scoped tools:

1. Run the prompt baseline evaluation:
   ```bash
   npm run eval:baseline
   ```
   This command serializes all game actions into a single system prompt.

2. Run the scoped tools evaluation:
   ```bash
   npm run eval:tools
   ```
   This command registers active tools dynamically based on room state and player inventory.

Both commands publish to the `intent-recognition` group in Laminar with tags `approach: "prompt-baseline"` and `approach: "scoped-tools"`.
