import { useObservableState } from 'observable-hooks';
import React, { useEffect, useRef } from 'react';
import { fullLog$ } from './log';

/**
 * BIOS Status Component
 * @public
 */
export const BIOS = React.memo(() => {
  const fullLog = useObservableState(fullLog$);
  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [fullLog]);
  return (
    <div>
      <pre style={{ fontSize: 24 }}>
        <code>{fullLog}</code>
      </pre>
    </div>
  );
});
