import { createQuoteStateV0 } from './v0';
import { createQuoteStateV1 } from './v1';
import { createQuoteStateV2 } from './v2';
import { createQuoteStateV3 } from './v3';

export const implementations = {
  baseline: createQuoteStateV0,
  current: createQuoteStateV1,
  v0: createQuoteStateV0,
  v1: createQuoteStateV1,
  v2: createQuoteStateV2,
  v3: createQuoteStateV3,
};
