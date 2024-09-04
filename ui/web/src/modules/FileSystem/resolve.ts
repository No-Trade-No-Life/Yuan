import * as path from 'path-browserify';
import { fs } from './api';
// const isCore = require('is-core-module');
// const caller = require('./caller');
var getNodeModulesDirs = function getNodeModulesDirs(absoluteStart: string, modules: string[]) {
  var prefix = '/';
  if (/^([A-Za-z]:)/.test(absoluteStart)) {
    prefix = '';
  } else if (/^\\\\/.test(absoluteStart)) {
    prefix = '\\\\';
  }

  var paths = [absoluteStart];
  var parsed = path.parse(absoluteStart);
  while (parsed.dir !== paths[paths.length - 1]) {
    paths.push(parsed.dir);
    parsed = path.parse(parsed.dir);
  }

  return paths.reduce(function (dirs, aPath) {
    return dirs.concat(
      modules.map(function (moduleDir: string) {
        return path.resolve(prefix, aPath, moduleDir);
      }),
    );
  }, [] as string[]);
};

const nodeModulesPaths = function nodeModulesPaths(start: string, opts: IOptions, request: string) {
  var modules =
    opts && opts.moduleDirectory ? ([] as string[]).concat(opts.moduleDirectory) : ['node_modules'];

  if (opts && typeof opts.paths === 'function') {
    return opts.paths(
      request,
      start,
      function () {
        return getNodeModulesDirs(start, modules);
      },
      opts,
    );
  }

  var dirs = getNodeModulesDirs(start, modules);
  return opts && opts.paths && Array.isArray(opts.paths) ? dirs.concat(opts.paths) : dirs;
};

const realpathFS = async (x: string): Promise<string> => x;

const homedir = '/';
const defaultPaths = function (): string[] {
  return [path.join(homedir, '.node_modules'), path.join(homedir, '.node_libraries')];
};

const defaultIsFile = async function isFile(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return !!stat && stat.isFile();
  } catch (e) {
    // if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return false;
    // throw e;
    return false;
  }
};

const defaultIsDir = async function isDirectory(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return !!stat && stat.isDirectory();
  } catch (e) {
    // if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return false;
    // throw e;
    return false;
  }
};

const defaultRealpathSync = async function realpathSync(x: string): Promise<string> {
  try {
    return realpathFS(x);
  } catch (realpathErr) {
    return x;
  }
};

const maybeRealpathSync = async function maybeRealpathSync(
  realpathSync: typeof realpathFS,
  x: string,
  opts: IOptions,
): Promise<string> {
  if (!opts || !opts.preserveSymlinks) {
    return realpathSync(x);
  }
  return x;
};

interface PackageJson {
  name?: string;
  main?: string;
  module?: string;
  dir?: string;
  pkg?: PackageJson;
}

interface IOptions {
  isFile?: (file: string) => Promise<boolean>;
  isDirectory?: (dir: string) => Promise<boolean>;
  realpathSync?: (x: string) => Promise<string>;
  readFileSync?: (file: string) => Promise<string>;
  readPackageSync?: (file: string) => Promise<PackageJson>;
  preserveSymlinks?: boolean;
  extensions?: string[];
  includeCoreModules?: boolean;
  basedir?: string;
  filename?: string;
  paths?: string[] | ((request: string, start: string, getPaths: () => string[], opts: IOptions) => string[]);
  packageFilter?: (pkg: PackageJson, pkgfile: string, dir: string) => PackageJson;
  /**
   * transform a path within a package
   *
   * @param pkg - package data
   * @param path - the path being resolved
   * @param relativePath - the path relative from the package.json location
   * @returns - a relative path that will be joined from the package.json location
   */
  pathFilter?: (pkg: PackageJson, path: string, relativePath: string) => string;
  moduleDirectory?: string[];
  packageIterator?: (request: string, start: string, thunk: () => string[], opts: IOptions) => string[];
}

const defaultReadPackageSync = async function defaultReadPackageSync(
  readFileSync: (file: string) => Promise<string>,
  pkgfile: string,
): Promise<PackageJson> {
  return JSON.parse(await readFileSync(pkgfile));
};

const getPackageCandidates = function getPackageCandidates(x: string, start: string, opts: IOptions) {
  const dirs = nodeModulesPaths(start, opts, x);
  for (let i = 0; i < dirs.length; i++) {
    dirs[i] = path.join(dirs[i], x);
  }
  return dirs;
};

export async function resolve(x: string, options: IOptions) {
  if (typeof x !== 'string') {
    throw new TypeError('Path must be a string.');
  }
  const opts = options;

  const isFile = opts.isFile || defaultIsFile;
  const isDirectory = opts.isDirectory || defaultIsDir;
  const readFileSync = opts.readFileSync || fs.readFile;
  const realpathSync = opts.realpathSync || defaultRealpathSync;
  const readPackageSync = defaultReadPackageSync;
  if (opts.readFileSync && opts.readPackageSync) {
    throw new TypeError('`readFileSync` and `readPackageSync` are mutually exclusive.');
  }
  const packageIterator = opts.packageIterator;

  const extensions = opts.extensions || ['.js'];
  const includeCoreModules = opts.includeCoreModules !== false;
  const basedir = opts.basedir || path.dirname(caller());
  const parent = opts.filename || basedir;

  opts.paths = opts.paths || defaultPaths();

  // ensure that `basedir` is an absolute path at this point, resolving against the process' current working directory
  const absoluteStart = await maybeRealpathSync(realpathSync, path.resolve(basedir), opts);

  if (opts.basedir && !(await isDirectory(absoluteStart))) {
    throw new TypeError(
      'Provided basedir "' +
        opts.basedir +
        '" is not a directory' +
        (opts.preserveSymlinks ? '' : ', or a symlink to a directory'),
    );
  }

  if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(x)) {
    let res = path.resolve(absoluteStart, x);
    if (x === '.' || x === '..' || x.slice(-1) === '/') res += '/';
    const m = (await loadAsFileSync(res)) || (await loadAsDirectorySync(res));
    if (m) return maybeRealpathSync(realpathSync, m, opts);
  } else if (includeCoreModules && isCore(x)) {
    return x;
  } else {
    const n = await loadNodeModulesSync(x, absoluteStart);
    if (n) return maybeRealpathSync(realpathSync, n, opts);
  }

  throw new Error("Cannot find module '" + x + "' from '" + parent + "'");

  async function loadAsFileSync(x: string): Promise<string | undefined> {
    const pkg = await loadpkg(path.dirname(x));

    if (pkg && pkg.dir && pkg.pkg && opts.pathFilter) {
      const rfile = path.relative(pkg.dir, x);
      const r = opts.pathFilter(pkg.pkg, x, rfile);
      if (r) {
        x = path.resolve(pkg.dir, r);
      }
    }

    if (await isFile(x)) {
      return x;
    }

    for (let i = 0; i < extensions.length; i++) {
      const file = x + extensions[i];
      if (await isFile(file)) {
        return file;
      }
    }
  }

  async function loadpkg(dir: string): Promise<PackageJson | undefined> {
    if (dir === '' || dir === '/') return;
    // if (process.platform === 'win32' && /^\w:[/\\]*$/.test(dir)) {
    //   return;
    // }
    if (/[/\\]node_modules[/\\]*$/.test(dir)) return;

    const pkgfile = path.join(
      (await isDirectory(dir)) ? await maybeRealpathSync(realpathSync, dir, opts) : dir,
      'package.json',
    );

    if (!(await isFile(pkgfile))) {
      return loadpkg(path.dirname(dir));
    }

    let pkg;
    try {
      pkg = await readPackageSync(readFileSync, pkgfile);
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        throw e;
      }
    }

    if (pkg && opts.packageFilter) {
      pkg = opts.packageFilter(pkg, pkgfile, dir);
    }

    return { pkg: pkg, dir: dir };
  }

  async function loadAsDirectorySync(x: string): Promise<string | void> {
    const pkgfile = path.join(
      (await isDirectory(x)) ? await maybeRealpathSync(realpathSync, x, opts) : x,
      '/package.json',
    );
    if (await isFile(pkgfile)) {
      let pkg: PackageJson | undefined;
      try {
        pkg = await readPackageSync(readFileSync, pkgfile);
      } catch (e) {}

      if (pkg && opts.packageFilter) {
        pkg = opts.packageFilter(pkg, pkgfile, x);
      }

      // ESModule support
      if (pkg && pkg.module) {
        if (typeof pkg.module !== 'string') {
          throw new TypeError('package “' + pkg.name + '” `module` must be a string');
        }
        if (pkg.module === '.' || pkg.module === './') {
          pkg.module = 'index';
        }
        try {
          const mainPath = path.resolve(x, pkg.module);
          const m = await loadAsFileSync(mainPath);
          if (m) return m;
          const n = await loadAsDirectorySync(mainPath);
          if (n) return n;
          const checkIndex = await loadAsFileSync(path.resolve(x, 'index'));
          if (checkIndex) return checkIndex;
        } catch (e) {}
        throw new Error(
          "Cannot find module '" +
            path.resolve(x, pkg.module) +
            '\'. Please verify that the package.json has a valid "main" entry',
        );
      }

      if (pkg && pkg.main) {
        if (typeof pkg.main !== 'string') {
          throw new TypeError('package “' + pkg.name + '” `main` must be a string');
        }
        if (pkg.main === '.' || pkg.main === './') {
          pkg.main = 'index';
        }
        try {
          const mainPath = path.resolve(x, pkg.main);
          const m = await loadAsFileSync(mainPath);
          if (m) return m;
          const n = await loadAsDirectorySync(mainPath);
          if (n) return n;
          const checkIndex = await loadAsFileSync(path.resolve(x, 'index'));
          if (checkIndex) return checkIndex;
        } catch (e) {}
        throw new Error(
          "Cannot find module '" +
            path.resolve(x, pkg.main) +
            '\'. Please verify that the package.json has a valid "main" entry',
        );
      }
    }

    return loadAsFileSync(path.join(x, '/index'));
  }

  async function loadNodeModulesSync(x: string, start: string): Promise<string | void> {
    const thunk = function () {
      return getPackageCandidates(x, start, opts);
    };
    const dirs = packageIterator ? packageIterator(x, start, thunk, opts) : thunk();

    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      if (await isDirectory(path.dirname(dir))) {
        const m = await loadAsFileSync(dir);
        if (m) return m;
        const n = await loadAsDirectorySync(dir);
        if (n) return n;
      }
    }
  }
}
function isCore(x: string) {
  return false;
}
function caller(): string {
  return '/';
}

Object.assign(globalThis, { resolve });
