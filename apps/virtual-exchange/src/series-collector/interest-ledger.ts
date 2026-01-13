import { ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, formatTime, newError } from '@yuants/utils';
import { getCredentialByCredentialId } from '../credential';
import { IExchangeCredential } from '../types';
import { findBackwardTaskFirstStartTime, findForwardTaskLastEndTime, findPatchGap } from './sql-helpers';

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
  signal: AbortSignal,
) => {
  const { account_id, ledger_type } = decodeInterestLedgerSeriesId(series_id);

  const credential = await getCredentialByCredentialId(account_id);
  if (!credential) throw newError('CREDENTIAL_NOT_FOUND_WHEN_HANDLING_INGEST', { account_id });

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

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestLedger][Forward]',
    'Result',
    `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};

export const handleIngestInterestLedgerBackward = async (
  series_id: string,
  direction: 'forward' | 'backward',
) => {
  const { account_id, ledger_type } = decodeInterestLedgerSeriesId(series_id);

  const credential = await getCredentialByCredentialId(account_id);
  if (!credential) throw newError('CREDENTIAL_NOT_FOUND_WHEN_HANDLING_INGEST', { account_id });

  let req: IIngestInterestLedgerRequest;

  if (direction === 'backward') {
    const startTime = await findBackwardTaskFirstStartTime(terminal, series_id, 'account_interest_ledger');
    const time = startTime ? new Date(startTime).getTime() : Date.now();
    req = {
      account_id,
      direction,
      time,
      ledger_type,
      credential,
    };
  } else {
    // do backward using forward request with time = 0
    req = {
      account_id,
      direction,
      time: 0,
      ledger_type,
      credential,
    };
  }

  const res = await terminal.client.requestForResponseData<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestInterestLedger',
    req,
  );

  ingestCounter.labels({ task: 'backward' }).inc(res.wrote_count || 0);

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestLedger][Backward]',
    'Result',
    `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};

export const handleIngestInterestLedgerPatch = async (
  series_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const { account_id, ledger_type } = decodeInterestLedgerSeriesId(series_id);

  const credential = await getCredentialByCredentialId(account_id);
  if (!credential) throw newError('CREDENTIAL_NOT_FOUND_WHEN_HANDLING_INGEST', { account_id });

  const patch = await findPatchGap(terminal, 'account_interest_ledger', series_id);

  if (!patch) return; // no gap
  const time =
    direction === 'forward'
      ? new Date(patch.gap_start_time).getTime()
      : new Date(patch.gap_end_time).getTime();
  const req: IIngestInterestLedgerRequest = {
    account_id,
    direction,
    time,
    ledger_type,
    credential,
  };

  const res = await terminal.client.requestForResponseData<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestInterestLedger',
    req,
  );

  ingestCounter.labels({ task: 'patch' }).inc(res.wrote_count || 0);

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestLedger][Patch]',
    'Result',
    `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};

export const InterestLedger = {
  list: listInterestLedgerSeriesIds,
  forward: handleIngestInterestLedgerForward,
  backward: handleIngestInterestLedgerBackward,
  patch: handleIngestInterestLedgerPatch,
};
