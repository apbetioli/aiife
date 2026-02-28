import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

export function createModel() {
	const provider = process.env.LLM_PROVIDER ?? "anthropic";
	switch (provider) {
		case "anthropic":
			return anthropic(
				process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
			);
		case "openai":
			return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
				process.env.OPENAI_MODEL ?? "gpt-4o-mini",
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

export function createEvalModel() {
	const provider = process.env.EVAL_PROVIDER ?? "anthropic";
	switch (provider) {
		case "anthropic":
			return anthropic(
				process.env.EVAL_ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
			);
		case "openai":
			return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
				process.env.EVAL_OPENAI_MODEL ?? "gpt-4o-mini",
			);
		case "ollama":
			return createOpenAI({
				baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
				apiKey: "ollama",
			}).chat(process.env.EVAL_OLLAMA_MODEL ?? "llama3.1");
		default:
			throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
	}
}

/** Effective eval model id (provider + model name) for logging. */
export function getEvalModelId(): string {
	const provider = process.env.EVAL_PROVIDER ?? "anthropic";
	switch (provider) {
		case "anthropic":
			return process.env.EVAL_ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
		case "openai":
			return process.env.EVAL_OPENAI_MODEL ?? "gpt-4o-mini";
		case "ollama":
			return process.env.EVAL_OLLAMA_MODEL ?? "llama3.1";
		default:
			return `${provider}:unknown`;
	}
}
