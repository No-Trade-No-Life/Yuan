import { ImapMessageAttributes } from 'imap';
import { ParsedMail } from 'mailparser';

export interface IEmail {
  address: string;
  uid: string;
  attrs: ImapMessageAttributes;
  body: ParsedMail;
}
