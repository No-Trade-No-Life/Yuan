## API Report File for "@yuants/sql"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { Terminal } from '@yuants/protocol';

// @public
export const AddMigration: (migration: ISQLMigration) => void;

// @public
export const buildInsertManyIntoTableSQL: <T extends {}>(data: T[], tableName: string, options?: {
    columns?: (keyof T)[] | undefined;
    keyFn?: ((data: T) => string) | undefined;
    ignoreConflict?: boolean | undefined;
} | undefined) => string;

// @public
const escape_2: (val: any, options?: {}) => string;
export { escape_2 as escape }

// @public
export const ExecuteMigrations: (terminal: Terminal) => Promise<void>;

// @public (undocumented)
export interface ISQLMigration {
    dependencies: string[];
    id: string;
    name: string;
    statement: string;
}

// @public
export const requestSQL: <T = unknown>(terminal: Terminal, query: string) => Promise<T>;

// (No @packageDocumentation comment for this package)

```
