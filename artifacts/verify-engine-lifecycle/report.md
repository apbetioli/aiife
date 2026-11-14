# EngineLifecycle

TLC reached 2,876 states, more than the chart budget of 500, so the chart draws only the bug paths: 9 states and 9 arrows.
The chart does not draw 2 steps that stay in one chart state.
The step player quits changes Location, Session and History at the same time.
The step player moves room changes Location and History at the same time.
The step player restores slot changes Location and History at the same time.
The step player runs undo changes Location and History at the same time.

## StoppedActionPurity breaks
The shortest path has 1 step:
0. Location room_a (m=0), Session Active, History Depth 0
1. action stops (leaks dirty state): Location room_a (m=0), Session Tainted, History Depth 0

## GameOverTerminal breaks
The shortest path has 2 steps:
0. Location room_a (m=0), Session Active, History Depth 0
1. player quits: Location room_a (m=1), Session Quit, History Depth 1
2. player saves slot: Location room_a (m=1), Session Quit, History Depth 1

## UndoNeverAdvancesTurn breaks
The shortest path has 4 steps:
0. Location room_a (m=0), Session Active, History Depth 0
1. player saves slot: Location room_a (m=0), Session Active, History Depth 0
2. player moves room: Location room_b (m=1), Session Active, History Depth 1
3. player restores slot: Location room_a (m=0), Session Active, History Depth 2
4. player runs undo: Location room_b (m=1), Session Active, History Depth 1

## Rules that hold
HistoryBounded, NoDeadlock
