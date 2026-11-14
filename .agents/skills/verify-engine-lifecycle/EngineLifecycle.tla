------------------------ MODULE EngineLifecycle ------------------------
EXTENDS Naturals, Sequences

CONSTANTS
    Rooms,          \* Set of rooms, e.g. {"room_a", "room_b"}
    Slots,          \* Set of save slots, e.g. {"slot1"}
    MaxHistory,     \* Max history depth (e.g. 2 or 3, corresponding to MAX_UNDO_HISTORY)
    MaxMoves        \* Bound on move count to keep state space finite

VARIABLES
    currentRoom,    \* Current room in GameState (state.player.current_room)
    moves,          \* Move count (state.player.state.moves)
    priorMoves,     \* Move count in previous step, used to verify UndoNeverAdvancesTurn
    isQuit,         \* Game over / quit flag (state.player.state.quit)
    isTainted,      \* Dirty flag representing un-rolled-back mutation on stopped action
    history,        \* Sequence of prior GameState snapshots (this.history)
    storage,        \* Save file storage (this.storage)
    lastAction      \* String identifying the last action taken

vars == <<currentRoom, moves, priorMoves, isQuit, isTainted, history, storage, lastAction>>

StateSnapshot == [
    room       : Rooms,
    moves      : 0..MaxMoves,
    isQuit     : BOOLEAN,
    isTainted  : BOOLEAN
]

PushHistory(h, snap) ==
    IF Len(h) >= MaxHistory
    THEN Append(SubSeq(h, 2, Len(h)), snap)
    ELSE Append(h, snap)

CurrentSnapshot == [
    room       |-> currentRoom,
    moves      |-> moves,
    isQuit     |-> isQuit,
    isTainted  |-> isTainted
]

Init ==
    /\ currentRoom = "room_a"
    /\ moves = 0
    /\ priorMoves = 0
    /\ isQuit = FALSE
    /\ isTainted = FALSE
    /\ history = <<>>
    /\ storage = [s \in Slots |-> [saved |-> FALSE, snapshot |-> CurrentSnapshot]]
    /\ lastAction = "start"

\* Normal player action (e.g. "go") matching GameEngine.runAction lines 155-175:
\* 1. Evaluates action
\* 2. Sets this.state = result.state
\* 3. Pushes prevState to history
\* 4. Fires "tick", incrementing moves
Move(targetRoom) ==
    /\ currentRoom # targetRoom
    /\ moves < MaxMoves
    /\ ~isQuit
    /\ currentRoom' = targetRoom
    /\ moves' = moves + 1
    /\ priorMoves' = moves
    /\ history' = PushHistory(history, CurrentSnapshot)
    /\ lastAction' = "move"
    /\ UNCHANGED <<isQuit, isTainted, storage>>

\* An action stopped mid-execution where partial mutation occurs before event.stop().
\* Matches GameEngine.ts lines 163-166:
\* this.state = result.state;
\* if (result.stopped) return feedback; // pushHistory is skipped!
StoppedMove ==
    /\ ~isQuit
    /\ isTainted' = TRUE
    /\ priorMoves' = moves
    /\ lastAction' = "stopped_move"
    /\ UNCHANGED <<currentRoom, moves, isQuit, history, storage>>

\* Player calls "undo" (GameEngine.ts lines 177-184):
\* Pops the top state from this.history.
\* If history is empty, does nothing.
Undo ==
    /\ priorMoves' = moves
    /\ IF Len(history) = 0
       THEN /\ lastAction' = "undo_empty"
            /\ UNCHANGED <<currentRoom, moves, isQuit, isTainted, history, storage>>
       ELSE LET top == history[Len(history)]
            IN /\ currentRoom' = top.room
               /\ moves' = top.moves
               /\ isQuit' = top.isQuit
               /\ isTainted' = top.isTainted
               /\ history' = SubSeq(history, 1, Len(history) - 1)
               /\ lastAction' = "undo"
               /\ UNCHANGED <<storage>>

\* Player calls "save <slot>" (GameEngine.ts lines 129-137):
\* Serializes current state to storage. Does not modify history or turn.
Save(slot) ==
    /\ storage' = [storage EXCEPT ![slot] = [saved |-> TRUE, snapshot |-> CurrentSnapshot]]
    /\ priorMoves' = moves
    /\ lastAction' = "save"
    /\ UNCHANGED <<currentRoom, moves, isQuit, isTainted, history>>

\* Player calls "restore <slot>" (GameEngine.ts lines 140-153 and 190-199):
\* Real code:
\* this.pushHistory(this.state);
\* this.state = restored;
\* Note: this.history is NOT cleared!
Restore(slot) ==
    /\ storage[slot].saved = TRUE
    /\ LET target == storage[slot].snapshot
       IN /\ currentRoom' = target.room
          /\ moves' = target.moves
          /\ priorMoves' = moves
          /\ isQuit' = target.isQuit
          /\ isTainted' = target.isTainted
          /\ history' = PushHistory(history, CurrentSnapshot)
          /\ lastAction' = "restore"
          /\ UNCHANGED <<storage>>

\* Player calls "quit" (GameEngine.ts lines 155-175 with quit action):
Quit ==
    /\ ~isQuit
    /\ moves < MaxMoves
    /\ isQuit' = TRUE
    /\ moves' = moves + 1
    /\ priorMoves' = moves
    /\ history' = PushHistory(history, CurrentSnapshot)
    /\ lastAction' = "quit"
    /\ UNCHANGED <<currentRoom, isTainted, storage>>

Next ==
    \/ \E r \in Rooms : Move(r)
    \/ StoppedMove
    \/ Undo
    \/ \E s \in Slots : Save(s)
    \/ \E s \in Slots : Restore(s)
    \/ Quit

-----------------------------------------------------------------------------
\* INVARIANTS

\* Invariant 1: History is always bounded by MaxHistory (MAX_UNDO_HISTORY)
HistoryBounded ==
    Len(history) <= MaxHistory

\* Invariant 2: Stopped actions must not leave persistent tainted/dirty mutations.
\* Harms user: Stopped/rejected actions corrupt state and cannot be undone.
StoppedActionPurity ==
    ~isTainted

\* Invariant 3: Game over is terminal; normal actions cannot execute after quit.
\* Harms user: Player continues playing in a zombie state after game ended.
GameOverTerminal ==
    isQuit => lastAction \in {"quit", "undo", "restore"}

\* Invariant 4: Undoing must never advance the player forward in moves.
\* Harms user: Undoing a restored session teleports the player into an abandoned future.
UndoNeverAdvancesTurn ==
    (lastAction = "undo") => (moves <= priorMoves)

=============================================================================
