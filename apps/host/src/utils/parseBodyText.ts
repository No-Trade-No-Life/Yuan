import type { IncomingMessage } from 'http';

export const parseBodyText = async (req: IncomingMessage): Promise<string> => {
  return new Promise<string>((resolve) => {
    const body: Uint8Array[] = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    });
    req.on('end', () => {
      const reqBody = Buffer.concat(body).toString();
      resolve(reqBody);
    });
  });
};
