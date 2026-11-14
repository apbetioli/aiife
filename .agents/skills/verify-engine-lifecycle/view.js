export const state = (v) => ({
	Location: `${v.currentRoom} (m=${v.moves})`,
	Session: v.isQuit ? "Quit" : v.isTainted ? "Tainted" : "Active",
	History: `Depth ${Array.isArray(v.history) ? v.history.length : v.history ? Object.keys(v.history).length : 0}`,
});

export const step = (action, _from, _to) => {
	if (action.startsWith("Move")) return "player moves room";
	if (action === "StoppedMove") return "action stops (leaks dirty state)";
	if (action === "Undo") return "player runs undo";
	if (action.startsWith("Save")) return "player saves slot";
	if (action.startsWith("Restore")) return "player restores slot";
	if (action === "Quit") return "player quits";
	return action;
};

export const title = "AIIFE GameEngine Lifecycle & History Invariants";
