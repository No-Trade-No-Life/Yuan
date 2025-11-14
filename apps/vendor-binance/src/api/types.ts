export interface IBinanceCredential {
  access_key: string;
  secret_key: string;
}

export interface IBinanceErrorResponse {
  code: number;
  msg: string;
}

export const isBinanceErrorResponse = (value: any): value is IBinanceErrorResponse =>
  value !== null && typeof value === 'object' && typeof value.code === 'number' && typeof value.msg === 'string';
