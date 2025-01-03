import { Table } from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';
import { ListView } from './ListView';
import { TableView } from './TableView';

export function DataView<T>(props: { table: Table<T> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Responsible Layout
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          setWidth(entry.contentRect.width);
        });
      });
      observer.observe(el);
      return () => {
        observer.unobserve(el);
      };
    }
  }, []);
  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {width === null ? null : width > 1080 ? (
        <TableView table={props.table} />
      ) : (
        <ListView table={props.table} />
      )}
    </div>
  );
}
