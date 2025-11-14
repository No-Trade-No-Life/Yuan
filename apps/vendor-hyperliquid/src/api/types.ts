import { Wallet } from 'ethers';

export interface ICredential {
  private_key: string;
  address: string;
}

export const createCredential = (private_key: string): ICredential => {
  const wallet = new Wallet(private_key);
  return { private_key, address: wallet.address };
};

export const getDefaultCredential = (): ICredential => {
  const private_key = process.env.PRIVATE_KEY;
  if (!private_key) {
    throw new Error('Missing Hyperliquid credential: PRIVATE_KEY must be set');
  }
  return createCredential(private_key);
};
