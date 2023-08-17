/**
 * @packageDocumentation
 *
 * Example package of Yuan
 */

import { from, map, mergeAll, toArray } from 'rxjs';

/**
 * @remarks
 * A simple function that prints a string
 *
 * @public
 */
export function helloWorld() {
  from([['hello'], ['world']])
    .pipe(
      //
      mergeAll(),
      toArray(),
      map((texts) => texts.join(' '))
    )
    .subscribe((text) => console.info(text));
}

helloWorld();
