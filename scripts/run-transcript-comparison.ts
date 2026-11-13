import fs from "node:fs";
import zorkOne from "../games/zork-one";
import { GameAgent } from "../src/agent/game-agent";
import { createNarratorModel, createParserModel } from "../src/agent/model";
import { GameEngine } from "../src/engine/game-engine";

interface TurnData {
	cmd: string;
	output: string;
}

interface TranscriptData {
	intro: string;
	turns: TurnData[];
}

interface TurnResult {
	turn: number;
	cmd: string;
	expected: string;
	actual: string;
	current_room: string;
	inventory: string[];
	action_detected?: string;
	error?: string;
	durationMs: number;
}

async function main() {
	const data = JSON.parse(fs.readFileSync("artifacts/parsed-transcript.json", "utf-8")) as TranscriptData;
	const { world, setup } = zorkOne;
	const engine = new GameEngine(world, setup);
	const agent = new GameAgent(createParserModel(), engine, createNarratorModel());

	let history: any[] = [];
	const _startMsg = engine.start();

	const results: TurnResult[] = [];
	let lastAction = "";
	engine.addObserver((event) => {
		lastAction = `${event.name} ${JSON.stringify(event.params)}`;
	});

	console.log(`Starting execution of ${data.turns.length} turns...`);

	for (let i = 0; i < data.turns.length; i++) {
		const turn = data.turns[i];
		let output = "";
		let errStr: string | undefined;
		lastAction = "";
		const t0 = Date.now();
		try {
			history = await agent.run(turn.cmd, history, {
				onToken: () => {},
				onComplete: (res) => {
					output = res;
				},
			});
		} catch (err: any) {
			errStr = err.message || String(err);
			output = `ERROR: ${errStr}`;
		}
		const durationMs = Date.now() - t0;

		const state = (engine as any).state;
		const inv = Object.entries(state.objects)
			.filter(([_, v]: [string, any]) => v.location === "inventory")
			.map(([k]) => k);

		const result: TurnResult = {
			turn: i + 1,
			cmd: turn.cmd,
			expected: turn.output,
			actual: output,
			current_room: state.player.current_room,
			inventory: inv,
			action_detected: lastAction,
			error: errStr,
			durationMs,
		};
		results.push(result);

		if ((i + 1) % 25 === 0 || i === data.turns.length - 1) {
			console.log(
				`[${i + 1}/${data.turns.length}] Turn "${turn.cmd}" -> Room: ${state.player.current_room}, Action: ${lastAction} (${durationMs}ms)`,
			);
			fs.writeFileSync("artifacts/transcript-comparison.json", JSON.stringify(results, null, 2));
		}
	}

	fs.writeFileSync("artifacts/transcript-comparison.json", JSON.stringify(results, null, 2));
	console.log("Comparison complete! Results written to artifacts/transcript-comparison.json");
}

main().catch(console.error);
