import { readdirSync, existsSync, writeFileSync } from 'fs';

const file =
  readdirSync('./src/modules')
    .filter((moduleName) => existsSync(`./src/modules/${moduleName}/index.ts`))
    .map((moduleName) => `export * as ${moduleName} from './modules/${moduleName}';`)
    .join('\n') + '\n';

writeFileSync('./src/modules.ts', file);
