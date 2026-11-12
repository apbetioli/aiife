# Navigation and exploration

Navigation and exploration allows the player to move between connected rooms, view room descriptions and available exits, and discover new areas across the game world.

## Sub-features

- `nav-look`: re-describes the current room, visible items, and obvious features without moving or incrementing turn count.
- `nav-cardinal`: moves the player in a cardinal or ordinal direction (`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`, `u`, `d`) when an exit exists.
- `nav-blocked`: informs the player when an exit is impassable or locked.
- `nav-visited`: marks rooms as visited and updates player location in state.

## How to get to it (user POV)

- Type `look`, `look around`, or `l` at the prompt.
- Type direction abbreviations (`n`, `s`, `e`, `w`, `u`, `d`, `in`, `out`) or full names (`north`, `south`, etc.).
- Type `go <direction>`, `walk <direction>`, or `head <direction>`.

## Driving it with control-aiife

Preconditions:

- `control-aiife doctor` returns code 0.
- Starting game is `the-great-hall`.

- **Initial room inspection.** At start, the player is in The Great Hall. Run:
  `control-aiife drive --game the-great-hall --commands "look" --output-dir artifacts/verify-aiife/nav-look`
  Observable result: Output contains `The Great Hall`, description of tapestries, staircase, and iron door, with events `⚡look {}`.
- **Traverse open exit.** Move north from Great Hall to Library. Run:
  `control-aiife drive --game the-great-hall --commands "north" --output-dir artifacts/verify-aiife/nav-north`
  Observable result: Events show `⚡go {"direction":"north"}`, `⚡exit {"room":"great_hall"}`, `⚡enter {"room":"library"}`, and room title `The Library`.
- **Attempt blocked or locked exit.** Attempt to open or go through the locked cellar door. Run:
  `control-aiife drive --game the-great-hall --commands "down" --output-dir artifacts/verify-aiife/nav-blocked`
  Observable result: App reports that the way down is not available or locked without changing current room.
- **Return to origin.** Walk south back to the Great Hall. Run:
  `control-aiife drive --game the-great-hall --commands "north;south" --output-dir artifacts/verify-aiife/nav-return`
  Observable result: First moves to Library, then returns to The Great Hall with room description.

## Gotchas

- Fast-path handles single-word directions (`n`, `north`, `go north`) deterministically in <1ms without LLM latency.
- Entering an unrecognized direction (e.g. `fly up`) falls through to the LLM agent, which may take 1-3 seconds depending on provider.
- `look` re-executes automatically upon entering a new room; an extra `look` immediately after movement will double-describe the room.
