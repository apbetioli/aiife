import { Narrator } from "./ui/Narrator.js";

export function DEBUG(message: string, ...args: any[]) {
  const narrator = new Narrator();

  if (process.env.DEBUG) {
    console.debug(
      narrator.format({
        message: `[${message}]`,
        success: false,
        gameOver: true,
      }),
      ...args
    );
  }
}
