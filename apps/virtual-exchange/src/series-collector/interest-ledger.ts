import { Terminal } from '@yuants/protocol';
import { IExchangeCredential } from '../credential';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { findForwardTaskLastEndTime } from './sql-helpers';
import { ISeriesIngestResult } from '@yuants/exchange';

const parseInterestLedgerServiceMetadataFromSchema = (
  schema: any,
): { type: string; direction: 'backward' | 'forward'; ledgerTypes: string[] } => {
  //
  return {
    type: schema.properties.credential.properties.type.const,
    direction: schema.properties.direction.const,
    ledgerTypes: schema.properties.ledger_type.enum,
  };
};

const terminal = Terminal.fromNodeEnv();

export const listInterestLedgerSeriesIds = async () => {
  // List All Credentials from VEX
  const credentials = await terminal.client.requestForResponseData<
    {},
    Array<{ sign: string; credential: IExchangeCredential; credentialId?: string }>
  >('VEX/ListExchangeCredential', {});

  const series_ids = new Map<string, 'forward' | 'backward'>();

  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestInterestLedger') continue;
      try {
        const meta = parseInterestLedgerServiceMetadataFromSchema(serviceInfo.schema);

        for (const credential of credentials) {
          if (!credential.credentialId) continue;
          if (credential.credential.type !== meta.type) continue;

          for (const ledgerType of meta.ledgerTypes) {
            const series_id = encodeInterestLedgerSeriesId(credential.credentialId, ledgerType);
            series_ids.set(series_id, meta.direction);
          }
        }
      } finally {
      }
    }
  }

  return series_ids;
};

export const encodeInterestLedgerSeriesId = (account_id: string, ledger_type: string) =>
  encodePath(...decodePath(account_id), ledger_type);
export const decodeInterestLedgerSeriesId = (series_id: string) => {
  const parts = decodePath(series_id);
  const account_id = encodePath(...parts.slice(0, -1));
  const ledger_type = parts[parts.length - 1];
  return { account_id, ledger_type };
};

interface IIngestInterestLedgerRequest {
  account_id: string;
  direction: 'forward' | 'backward';
  time: number;
  ledger_type: string;
  credential: IExchangeCredential;
}

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'interest_ledger' });

export const handleIngestInterestLedgerForward = async (
  series_id: string,
  direction: 'forward' | 'backward',
) => {
  const { account_id, ledger_type } = decodeInterestLedgerSeriesId(series_id);

  let req: IIngestInterestLedgerRequest;

  if (direction === 'forward') {
    const endTime = await findForwardTaskLastEndTime(terminal, series_id, 'account_interest_ledger');
    const time = endTime ? new Date(endTime).getTime() : 0;
    req = {
      account_id,
      direction,
      time,
      ledger_type,
      credential,
    };
  } else {
    req = {
      account_id,
      direction,
      time: Date.now(),
      ledger_type,
      credential,
    };
  }

  const res = await terminal.client.requestForResponseData<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestInterestLedger',
    req,
  );

  ingestCounter.labels({ task: 'forward' }).inc(res.wrote_count || 0);
};
