# Item and inventory

Item and inventory enables players to discover in-scope objects, examine items for clues, take portable items into their inventory, check inventory contents, drop held items back into rooms, and open containers to reveal hidden objects.

## Sub-features

- `item-examine`: reveals detailed descriptions and puzzle hints for items in scope or carried.
- `item-take`: transfers an in-scope carriable item from the room into player inventory.
- `item-inventory`: lists all currently carried objects.
- `item-drop`: removes an item from player inventory and places it on the floor of the current room.
- `item-container`: opening a container (e.g. mailbox or chest) reveals its contents into scope.

## How to get to it (user POV)

- Type `take <item>`, `pick up <item>`, or `get <item>`.
- Type `inventory`, `inv`, or `i`.
- Type `examine <item>`, `x <item>`, or `look at <item>`.
- Type `drop <item>` or `put down <item>`.
- Type `open <container>` or `open <door>`.

## Driving it with control-aiife

Preconditions:

- `control-aiife doctor` returns code 0.
- Starting game is `the-great-hall` (brass lantern in starting room) or `zork-one` (small mailbox and leaflet).

- **Examine room item.** Examine the lantern in The Great Hall. Run:
  `control-aiife drive --game the-great-hall --commands "examine brass lantern" --output-dir artifacts/verify-aiife/item-examine`
  Observable result: Narrative reports `A sturdy brass lantern. It casts a warm, steady glow.` with event `⚡examine {"objects":["brass_lantern"]}`.
- **Check empty inventory.** View inventory before taking items. Run:
  `control-aiife drive --game the-great-hall --commands "inventory" --output-dir artifacts/verify-aiife/item-inv-empty`
  Observable result: Narrative states `You are empty-handed.` with event `⚡inventory {}`.
- **Take item into inventory.** Pick up the brass lantern. Run:
  `control-aiife drive --game the-great-hall --commands "take brass lantern;inventory" --output-dir artifacts/verify-aiife/item-take`
  Observable result: Narrative confirms `Taken.` or `You take the brass lantern.`, and `inventory` lists `brass lantern`.
- **Drop item back in room.** Drop the held lantern. Run:
  `control-aiife drive --game the-great-hall --commands "take brass lantern;drop brass_lantern;inventory" --output-dir artifacts/verify-aiife/item-drop`
  Observable result: Narrative reports `Dropped.` with event `⚡drop {"objects":["brass_lantern"]}`, and inventory returns to empty.
- **Reveal contents via container.** In `zork-one`, open the mailbox to reveal the leaflet. Run:
  `control-aiife drive --game zork-one --commands "open small mailbox;examine leaflet" --output-dir artifacts/verify-aiife/item-container`
  Observable result: Opening mailbox reveals `leaflet`, and examining leaflet displays `WELCOME TO ZORK!`.

## Gotchas

- Standard items have human-readable names and internal IDs. Fast-path `drop` expects the ID or name matching the regex.
- Items inside closed containers are not in scope until the container is opened. Attempting to take an item from a closed container will fail with a scope error.
- Fixed scenery items (such as the heavy iron door or stone pedestal) cannot be picked up and will reject `take` with a message that the item cannot be taken.
