import { createQuoteStateV0 } from './v0';
import { createQuoteStateV1 } from './v1';

export const implementations = {
  baseline: createQuoteStateV0,
  current: createQuoteStateV1,
};
