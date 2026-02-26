import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

export function createModel() {
	const provider = process.env.LLM_PROVIDER ?? "anthropic";
	switch (provider) {
		case "anthropic":
			return anthropic(
				process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
			);
		case "openai":
			return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
				process.env.OPENAI_MODEL ?? "gpt-4o",
			);
		case "ollama":
			return createOpenAI({
				baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
				apiKey: "ollama",
			}).chat(process.env.OLLAMA_MODEL ?? "llama3.1");
		default:
			throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
	}
}
