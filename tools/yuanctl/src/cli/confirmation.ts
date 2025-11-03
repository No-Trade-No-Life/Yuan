import readline from 'readline';

export const confirmAction = async (message: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer: string = await new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (response) => resolve(response));
  });
  rl.close();
  return answer.trim().toLowerCase() === 'y';
};
