import { useMAX, useMIN } from '@libs';

const LOW_TYPE = 0;
const HIGH_TYPE = 1;

export const useZigZag = (high: Series, low: Series, period: number) => {
  const lastHighPeak = useSeries('lastHighPeak', high, { display: 'line' });
  // add second paramenter {"type": "Line", "panel": "main"} to plot in the graph, e.g.
  //   const lastHighPeak = useOutputSeries("lastHighPeak", {"type": "Line", "panel": "main"});
  const lastLowPeak = useSeries('lastLowPeak', high);
  const zigzagValue = useSeries('zigzagValue', high);

  const currentZigzagValue = useSeries('currentZigzagValue', high);
  const lastZigzagValue = useSeries('lastZigzagValue', high);
  const secondLastZigzagValue = useSeries('secondLastZigzagValue', high);

  const sourceMax = useMAX(high, period);
  const sourceMin = useMIN(low, period);

  const lastHigh = useRef(0);
  const lastLow = useRef(0);
  const lastHighIdx = useRef(0);
  const lastLowIdx = useRef(0);
  const zigzagValueList = useRef<number[]>([]);

  useEffect(() => {
    for (let i = Math.max(0, lastLowPeak.length) - 1; i < high.length - 1; i++) {
      if (i <= 0) {
        lastHighPeak[0] = high[0];
        lastLowPeak[0] = low[0];
        lastHighIdx.current = 0;
        lastLowIdx.current = 0;
        lastHigh.current = high[0];
        lastLow.current = low[0];
        zigzagValue[0] = NaN;
        zigzagValueList.current = [];
      } else {
        lastLowPeak[i] = lastLowPeak[i - 1];
        lastHighPeak[i] = lastHighPeak[i - 1];
        zigzagValue[i] = NaN;

        if (isPeriodHighest(i)) {
          if (
            getLastPeakType() == LOW_TYPE ||
            (getLastPeakType() == HIGH_TYPE && high[i] > lastHigh.current)
          ) {
            lastHighPeak[i] = high[i];

            zigzagValue[i] = high[i];
            if (getLastPeakType() == HIGH_TYPE) {
              zigzagValue[lastHighIdx.current] = NaN;
              zigzagValueList.current.pop();
            }

            zigzagValueList.current.push(high[i]);
            lastHighIdx.current = i;
            lastHigh.current = high[i];
          }
        } else if (isPeriodLowest(i)) {
          if (getLastPeakType() == HIGH_TYPE || (getLastPeakType() == LOW_TYPE && low[i] < lastLow.current)) {
            lastLowPeak[i] = low[i];

            zigzagValue[i] = low[i];
            if (getLastPeakType() == LOW_TYPE) {
              zigzagValue[lastLowIdx.current] = NaN;
              zigzagValueList.current.pop();
            }

            zigzagValueList.current.push(low[i]);
            lastLowIdx.current = i;
            lastLow.current = low[i];
          }
        }
      }

      const zigzagLength = zigzagValueList.current.length;
      if (zigzagLength == 0) {
        currentZigzagValue[i] = NaN;
        lastZigzagValue[i] = NaN;
        secondLastZigzagValue[i] = NaN;
      } else if (zigzagLength == 1) {
        currentZigzagValue[i] = zigzagValueList.current[zigzagLength - 1];
        lastZigzagValue[i] = NaN;
        secondLastZigzagValue[i] = NaN;
      } else if (zigzagLength == 2) {
        currentZigzagValue[i] = zigzagValueList.current[zigzagLength - 1];
        lastZigzagValue[i] = zigzagValueList.current[zigzagLength - 2];
        secondLastZigzagValue[i] = NaN;
      } else {
        currentZigzagValue[i] = zigzagValueList.current[zigzagLength - 1];
        lastZigzagValue[i] = zigzagValueList.current[zigzagLength - 2];
        secondLastZigzagValue[i] = zigzagValueList.current[zigzagLength - 3];
      }
    }
    if (high.length >= 1) {
      lastHighPeak[high.length - 1] = NaN;
      lastLowPeak[high.length - 1] = NaN;
      currentZigzagValue[high.length - 1] = NaN;
      lastZigzagValue[high.length - 1] = NaN;
      secondLastZigzagValue[high.length - 1] = NaN;
    }
  });

  function getLastPeakType() {
    return lastHighIdx.current >= lastLowIdx.current ? HIGH_TYPE : LOW_TYPE;
  }

  function isPeriodHighest(curIndex: number) {
    return high[curIndex] == sourceMax[curIndex];
  }

  function isPeriodLowest(curIndex: number) {
    return low[curIndex] == sourceMin[curIndex];
  }
};
