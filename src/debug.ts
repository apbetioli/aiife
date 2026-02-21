import { Narrator } from "./ui/Narrator.js";

export function DEBUG(message: string, ...args: any[]) {
  const narrator = new Narrator();

  const format = (text: string) => {
    return narrator.format({
      message: `[${text}]`,
      success: false,
      gameOver: true,
    });
  };

  if (process.env.DEBUG) {
    console.debug(format(message), ...(args ?? []).map(format));
  }
}
