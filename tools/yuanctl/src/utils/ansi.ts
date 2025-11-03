const ENABLE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

const wrap =
  (code: number) =>
  (text: string): string =>
    ENABLE_COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;

export const bold = wrap(1);
export const gray = wrap(90);
