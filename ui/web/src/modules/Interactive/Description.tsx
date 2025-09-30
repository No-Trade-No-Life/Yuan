import React, { ReactNode } from 'react';

interface Props {
  data: Array<{
    key: string | ReactNode;
    value: string | ReactNode;
    suffix?: string | ReactNode;
    prefix?: string | ReactNode;
  }>;
}

export const Description = (props: Props) => {
  const { data } = props;
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '24px', flexGrow: 1 }}
    >
      {data.map((item, index) => (
        <div key={index}>
          <div style={{ color: 'rgba(var(--semi-grey-3), 1)', fontWeight: 600, fontSize: '14px' }}>
            {item.key}
          </div>
          <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: 'bold' }}>
            {item.prefix}
            {item.value}
            {item.suffix}
          </div>
        </div>
      ))}
    </div>
  );
};
