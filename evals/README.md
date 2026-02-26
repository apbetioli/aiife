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
   Both runs use the same `groupName` (`intent-recognition` or `move-tool-selection`), so they appear **side-by-side** in the Laminar dashboard. Use that view to compare:
   - **Scores** (actionSelection, parameterAccuracy, combined, or selectionScore) to see which model is more accurate.
   - **Traces** for each datapoint include model invocations and timing, so you can compare **latency** and token usage per run.

3. **Optional: per-case model**  
   Dataset entries can override the model via `data.config.model` (and `data.config.temperature`). The env var `EVAL_MODEL` overrides that when set, so it's ideal for "run everything with this model" comparisons.
