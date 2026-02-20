export function DEBUG(message: string, ...args: any[]) {
  if (process.env.DEBUG) {
    console.debug(message, ...args);
  }
}
