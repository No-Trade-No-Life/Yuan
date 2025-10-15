import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOrderBooks } from './utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { combineLatestWith, pipe, switchMap } from 'rxjs';
import { terminal$ } from '../Network';
import { decodePath } from '@yuants/utils';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { IProduct } from '@yuants/data-product';
import { Divider } from '@douyinfe/semi-ui';
import { DecimalFormatter } from './components/DecimalFormatNumber';

interface Props {
  uniqueProductId: string;
  rowHeight?: number;
  minRowsPerSide?: number;
  productInfo?: IProduct;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_MIN_ROWS_PER_SIDE = 5;
const COLUMN_TEMPLATE = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';

const parseVolumeToAmount = (value: string, valueScale: number) => {
  const volume = Number(value);
  return Number.isFinite(volume) ? volume * valueScale : 0;
};

export const OrderBook = React.memo((props: Props) => {
  const {
    uniqueProductId,
    rowHeight = DEFAULT_ROW_HEIGHT,
    minRowsPerSide = DEFAULT_MIN_ROWS_PER_SIDE,
    productInfo,
  } = props;

  const booksMap = useOrderBooks(uniqueProductId);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [rowsPerSide, setRowsPerSide] = useState(minRowsPerSide);

  const books = useMemo(() => {
    const bids = Array.from(booksMap?.bids.values() ?? []).sort((a, b) => +b[0] - +a[0]);
    const asks = Array.from(booksMap?.asks.values() ?? []).sort((a, b) => +a[0] - +b[0]);
    return {
      bids,
      asks,
      seqId: booksMap?.seqId ?? 0,
    };
  }, [booksMap]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (!Number.isFinite(height)) continue;
        const next = Math.max(minRowsPerSide, Math.floor(height / (rowHeight * 2)));
        setRowsPerSide((prev) => (prev === next ? prev : next));
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [rowHeight, minRowsPerSide]);

  const { askRows, bidRows, maxVolume } = useMemo(() => {
    if (!books) {
      return { askRows: [], bidRows: [], maxVolume: 0 };
    }
    const nextAsks = books.asks.slice(0, rowsPerSide);
    const nextBids = books.bids.slice(0, rowsPerSide);

    let localMaxVolume = 0;

    let askCumulative = 0;
    const computedAskRows = nextAsks.map(([price, volume, seqId]) => {
      const numericAmount = parseVolumeToAmount(volume, productInfo?.value_scale ?? 1);
      askCumulative += numericAmount;
      if (askCumulative > localMaxVolume) {
        localMaxVolume = askCumulative;
      }
      return { price, volume, cumulative: askCumulative, seqId, numericAmount: numericAmount };
    });

    let bidCumulative = 0;
    const computedBidRows = nextBids.map(([price, volume, seqId]) => {
      const numericAmount = parseVolumeToAmount(volume, productInfo?.value_scale ?? 1);
      bidCumulative += numericAmount;
      if (bidCumulative > localMaxVolume) {
        localMaxVolume = bidCumulative;
      }
      return { price, volume, cumulative: bidCumulative, seqId, numericAmount: numericAmount };
    });

    return { askRows: computedAskRows, bidRows: computedBidRows, maxVolume: localMaxVolume };
  }, [books, rowsPerSide, productInfo]);

  const renderRow = (
    row: { price: string; volume: string; cumulative: number; seqId: number; numericAmount: number },
    type: 'ask' | 'bid',
  ) => {
    const volumeRatio = maxVolume > 0 ? Math.min(row.cumulative / maxVolume, 1) : 0;
    const backgroundColor = type === 'bid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(248, 113, 113, 0.2)';

    return (
      <li
        style={{
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: COLUMN_TEMPLATE,
          alignItems: 'center',
          position: 'relative',
          height: rowHeight,
          padding: '0 8px',
          fontSize: 12,
          color: 'var(--semi-color-text-0)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: `${volumeRatio * 100}%`,
            backgroundColor,
            display: 'block',
            height: '100%',
            transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        <span style={{ position: 'relative' }}>{row.price}</span>
        <span style={{ position: 'relative', textAlign: 'right' }}>
          <DecimalFormatter number={row.numericAmount} />
        </span>
        <span style={{ position: 'relative', textAlign: 'right' }}>
          <DecimalFormatter number={row.cumulative} />
        </span>
      </li>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-1)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '8px 8px 4px',
          display: 'grid',
          gridTemplateColumns: COLUMN_TEMPLATE,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--semi-color-text-2)',
        }}
      >
        <li style={{ listStyle: 'none', textAlign: 'left' }}>价格</li>
        <li style={{ listStyle: 'none', textAlign: 'right' }}>数量</li>
        <li style={{ listStyle: 'none', textAlign: 'right' }}>累计数量</li>
      </ul>
      <div
        ref={listContainerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '4px 0 8px',
          overflow: 'hidden',
        }}
      >
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {askRows.length ? (
            askRows.reverse().map((row) => renderRow(row, 'ask'))
          ) : (
            <li
              style={{
                listStyle: 'none',
                textAlign: 'center',
                padding: '8px 0',
                fontSize: 12,
                color: 'var(--semi-color-text-2)',
              }}
            >
              No asks
            </li>
          )}
        </ul>
        <Divider />
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {bidRows.length ? (
            bidRows.map((row) => renderRow(row, 'bid'))
          ) : (
            <li
              style={{
                listStyle: 'none',
                textAlign: 'center',
                padding: '8px 0',
                fontSize: 12,
                color: 'var(--semi-color-text-2)',
              }}
            >
              No bids
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});

OrderBook.displayName = 'OrderBook';
