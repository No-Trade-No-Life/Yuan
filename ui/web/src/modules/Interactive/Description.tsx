import React, { ReactNode } from 'react';
import styles from './Description.module.css';

interface Props {
  data: Array<{
    key: string | ReactNode;
    value: string | ReactNode;
    suffix?: string | ReactNode;
    prefix?: string | ReactNode;
  }>;
  minColumnWidth?: number;
}

export const Description = (props: Props) => {
  const { data, minColumnWidth = 180 } = props;
  const columnWidthStyle = {
    ['--description-column-min-width' as const]: `${minColumnWidth}px`,
  } as React.CSSProperties;

  return (
    <div className={styles.container} style={columnWidthStyle}>
      {data.map((item, index) => (
        <div key={index} className={styles.item}>
          <div className={styles.label}>{item.key}</div>
          <div className={styles.value}>
            {item.prefix}
            {item.value}
            {item.suffix}
          </div>
        </div>
      ))}
    </div>
  );
};
