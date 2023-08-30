import * as fs from 'fs-extra';
import path from 'path';
export const currentPackageJson = fs.readJSONSync(path.join(process.cwd(), 'package.json'));
