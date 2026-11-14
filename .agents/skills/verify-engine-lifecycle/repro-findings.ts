import assert from "node:assert/strict";
import { makeTestWorld } from "../../../src/engine/__fixtures__/test-world";
import { GameEngine } from "../../../src/engine/game-engine";
import { PRIORITY } from "../../../src/engine/rules/priorities";
import { MemorySaveStorage } from "../../../src/engine/storage";

/**
 * Direct TypeScript reproduction of counterexamples discovered by TLC on EngineLifecycle.tla.
 */

console.log("=== Running Formal Verification Counterexample Repros ===");

// ----------------------------------------------------------------------------
// Finding 1: StoppedActionPurity
// Property: A stopped or rejected action must never leave persistent mutated state.
// TLC path:
//   0. Init (Active, moves=0)
//   1. StoppedMove -> Tainted state without undo history.
// ----------------------------------------------------------------------------
{
	console.log("\n[Test 1] StoppedActionPurity (Partial Mutation Leakage)...");
	const storage = new MemorySaveStorage();
	const world = makeTestWorld();
	const engine = new GameEngine(
		world,
		(bus) => {
			bus.on(
				"go",
				(event, state) => {
					state.player.state.tainted = true;
					event.stop();
					return "The way is magically sealed.";
				},
				{ priority: PRIORITY.GUARD },
			);
		},
		storage,
	);
	engine.start();

	const stateBefore = engine.save().state.player.state;
	assert.equal(stateBefore.tainted, undefined, "Initial state must not be tainted");

	const feedback = engine.runAction({ action: "go", direction: "south" });
	assert.equal(feedback, "The way is magically sealed.");

	const stateAfterStopped = engine.save().state.player.state;
	console.log("  State after stopped action:", stateAfterStopped);
	assert.equal(
		stateAfterStopped.tainted,
		true,
		"CONFIRMED BUG: Stopped action leaked tainted=true mutation into engine state",
	);

	const undoResult = engine.runAction({ action: "undo" });
	console.log("  Undo result after stopped action:", undoResult);
	assert.equal(undoResult, "Nothing to undo.", "CONFIRMED BUG: Engine has no undo record for the leaked mutation");
	console.log("  ✓ Finding 1 reproduced exactly as modeled.");
}

// ----------------------------------------------------------------------------
// Finding 2: UndoNeverAdvancesTurn & Timeline Contamination
// Property: Executing undo must never advance turn count or jump to an abandoned future.
// TLC path:
//   0. Save at room_a (m=0)
//   1. Move to room_b (m=1)
//   2. Restore slot (m=0)
//   3. Undo -> jumps to room_b (m=1)!
// ----------------------------------------------------------------------------
{
	console.log("\n[Test 2] UndoNeverAdvancesTurn (Timeline Splicing across Restore)...");
	const storage = new MemorySaveStorage();
	const world = makeTestWorld();
	const engine = new GameEngine(world, undefined, storage);
	engine.start();

	// Step 0: Save at start room (room_a, moves=0)
	engine.runAction({ action: "save", slot: "checkpoint" });
	assert.equal(engine.save().state.player.current_room, "room_a");
	assert.equal(engine.save().state.player.state.moves, 0);

	// Step 1: Move south to room_b (moves=1)
	engine.runAction({ action: "go", direction: "south" });
	assert.equal(engine.save().state.player.current_room, "room_b");
	assert.equal(engine.save().state.player.state.moves, 1);

	// Step 2: Restore checkpoint (restores to room_a, moves=0)
	engine.runAction({ action: "restore", slot: "checkpoint" });
	assert.equal(engine.save().state.player.current_room, "room_a");
	assert.equal(engine.save().state.player.state.moves, 0);

	// Step 3: Call undo immediately after restore
	engine.runAction({ action: "undo" });
	const roomAfterUndo = engine.save().state.player.current_room;
	const movesAfterUndo = engine.save().state.player.state.moves;
	console.log(`  After undo: Room=${roomAfterUndo}, Moves=${movesAfterUndo}`);

	assert.equal(roomAfterUndo, "room_b", "CONFIRMED BUG: Undo jumped forward into room_b from the abandoned future");
	assert.equal(movesAfterUndo, 1, "CONFIRMED BUG: Undo increased move count from 0 to 1");
	console.log("  ✓ Finding 2 reproduced exactly as modeled.");
}

// ----------------------------------------------------------------------------
// Finding 3: GameOverTerminal (Zombie Actions After Quit)
// Property: After quit, game actions must not mutate the world.
// TLC path:
//   0. Init
//   1. Quit (isGameOver=true)
//   2. Move room / Save slot -> executes successfully while quit!
// ----------------------------------------------------------------------------
{
	console.log("\n[Test 3] GameOverTerminal (Actions Executing After Quit)...");
	const storage = new MemorySaveStorage();
	const world = makeTestWorld();
	const engine = new GameEngine(world, undefined, storage);
	engine.start();

	const quitMsg = engine.runAction({ action: "quit" });
	assert.equal(quitMsg, "Goodbye!");
	assert.equal(engine.isGameOver(), true, "Engine reports isGameOver() is true");

	// Now execute a move action while quit
	const moveFeedback = engine.runAction({ action: "go", direction: "south" });
	console.log("  Move feedback after quit:", moveFeedback.split("\n")[0]);
	const roomAfterQuitMove = engine.save().state.player.current_room;
	console.log(`  Player room after moving while quit: ${roomAfterQuitMove}`);

	assert.equal(roomAfterQuitMove, "room_b", "CONFIRMED BUG: Engine moved player to room_b while isGameOver() is true");
	console.log("  ✓ Finding 3 reproduced exactly as modeled.");
}

console.log("\n=== All Formal Verification Findings Verified Against Real Code ===");
