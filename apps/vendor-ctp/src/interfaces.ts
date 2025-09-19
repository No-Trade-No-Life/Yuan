export interface IBridgeMessage<Req, Rep> {
  request_id: number;
  req?: {
    method: string;
    params: Req; // in JSON
  };
  res?: {
    error_code: number;
    error_message: string;
    event: string;
    value?: Rep; // in JSON
    is_last: boolean;
  };
}
