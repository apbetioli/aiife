# Evals

## Comparing models (quality and speed)

1. **Run the same eval with different models** using the `EVAL_MODEL` env var. Each run is sent to Laminar with a distinct run name so you can tell them apart.

   ```bash
   export LMNR_PROJECT_API_KEY=<your_key>

   # Model A
   EVAL_MODEL=gpt-4o npm run eval

   # Model B (e.g. cheaper/faster)
   EVAL_MODEL=gpt-4o-mini npm run eval
   ```

2. **Compare in Laminar**  
   Both runs use the same `groupName` (`intent-recognition`), so they appear **side-by-side** in the Laminar dashboard. Use that view to compare:
   - **Scores** (actionSelection, parameterAccuracy, combined, or selectionScore) to see which model is more accurate.
   - **Traces** for each datapoint include model invocations and timing, so you can compare **latency** and token usage per run.

3. **Optional: per-case model**  
   Dataset entries can override the model via `data.config.model` (and `data.config.temperature`). The env var `EVAL_MODEL` overrides that when set, so it's ideal for "run everything with this model" comparisons.

## Comparing approaches (Prompt Baseline vs Scoped Tools)

You can compare the baseline prompt-based intent parser against the native scoped-tools executor:

1. **Run the baseline** (dumps all actions in the system prompt + monolithic schema):
   ```bash
   npm run eval:baseline
   ```

2. **Run with Scoped Tools** (dynamically registers active tools based on room & objects):
   ```bash
   npm run eval:tools
   ```

Both runs share the same group (`intent-recognition`) in Laminar, tagged with `approach: "prompt-baseline"` and `approach: "scoped-tools"`, allowing side-by-side comparison of accuracy, latency, and token consumption.
