import { createCache } from '@yuants/cache';
import { useObservable, useObservableState } from 'observable-hooks';
import { memo } from 'react';
import { pipe, switchMap } from 'rxjs';

const cacheOfCountry = createCache<string>((address) =>
  fetch(`https://api.country.is/${address}`).then((x) => x.json().then((x) => x.country || 'Unknown')),
);

export const InlineIPv4 = memo((props: { ipv4: string }) => {
  const country = useObservableState(
    useObservable(
      //
      pipe(switchMap(([x]) => cacheOfCountry.query(x))),
      [props.ipv4],
    ),
  );
  return `${props.ipv4} (${country || ''})`;
});
