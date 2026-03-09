export const IS_DEBUG = process.env.DEBUG === "true";

export function getErrorDisplayMessage(error: unknown): string {
	if (!IS_DEBUG) {
		return "The dungeon master had some urgent business to attend to.";
	}
	if (error instanceof Error && error.stack) {
		return error.stack;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
