import { provideOHLCDurationService } from '@yuants/data-ohlc';
import { Terminal } from '@yuants/protocol';
import './product';

const terminal = Terminal.fromNodeEnv();

const DATASOURCE_ID = 'TQ';

const mapDurationToSec: Record<string, number> = {
  PT1M: 60,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,
  PT1H: 3600,
  PT2H: 7200,
  PT4H: 14400,
  P1D: 86400,
  P1W: 604800,
  P1M: 2592000,
  P1Y: 31536000,
};

provideOHLCDurationService(terminal, DATASOURCE_ID, () => Object.keys(mapDurationToSec));
