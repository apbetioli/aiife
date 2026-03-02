/**
 * Named priority bands for listener ordering (lower runs first).
 *
 * Within a band, use PRIORITY.X + 1 for "just after" ordering
 * rather than introducing new magic numbers.
 */
export const PRIORITY = {
	/** Param resolution (e.g. direction → from/to) */
	RESOLVE: 0,
	/** Validation & cancellation guards */
	GUARD: 50,
	/** Core state mutations */
	MUTATION: 100,
	/** Post-mutation reactions (e.g. container spill) */
	POST_MUTATION: 110,
	/** Side-effects, sub-events, descriptions */
	EFFECT: 150,
	/** Daemon / tick-driven recurring effects */
	DAEMON: 200,
} as const;
