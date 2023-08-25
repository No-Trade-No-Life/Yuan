import { OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import path from 'path-browserify';
import { v4 } from 'uuid';
import { ScriptUnit } from './ScriptUnit';
import {
  _nodeStack,
  _statusStack,
  useAccountInfo,
  useEffect,
  useExchange,
  useInfo,
  useLog,
  useMemo,
  useOutputSeries,
  useParamBoolean,
  useParamNumber,
  useParamSeries,
  useParamString,
  usePeriod,
  useRecordTable,
  useRef,
  useScript,
  useSinglePosition,
  useState,
  useUpdate,
} from './hook';

const compileContext = (content: string) => {
  const globalContext = {
    PositionVariant,
    OrderDirection,
    OrderType,
    useRef,
    useEffect,
    useMemo,
    useAccountInfo,
    useOutputSeries,
    useScript,
    useInfo,
    useUpdate,
    useLog,
    useParamString,
    useParamNumber,
    useParamBoolean,
    useParamSeries,
    usePeriod,
    useRecordTable,
    useSinglePosition,
    useExchange,
    useState,
  };

  const x = Object.entries(globalContext);

  return new Function(...x.map((x) => x[0]), content).bind(undefined, ...x.map((x) => x[1]));
};

/**
 * Script Instance
 * @public
 */
export class ScriptNode {
  constructor(
    public shell: ScriptUnit,
    public path: string,
    public referrer_path: string,
    public scriptConf: Record<string, any>,
  ) {}

  id = v4();

  _hooks: any[] = [];
  _hookIdx: number = 0;

  resolved_path!: string;

  private runScript!: Function;

  children: ScriptNode[] = [];

  _paramsSchema: JSONSchema7 = { type: 'object', properties: {} };

  getParamsSchema = (): JSONSchema7 => this._paramsSchema;

  async resolveScript(id: string, ref: string) {
    function* candidate() {
      if (id[0] === '.') {
        // 相对路径
        yield path.join(ref, '..', id);
        yield path.join(ref, '..', id + '.js');
      } else {
        // 绝对路径
        yield path.join('/', id);
        yield path.join('/', id + '.js');
      }
    }
    this.shell.kernel.log?.(`于 ${ref} 解析路径 ${id} ...`);
    for (const filename of candidate()) {
      try {
        const content = await this.shell.scriptResolver.readFile(filename);
        this.shell.kernel.log?.(`于 ${ref} 解析路径 ${id} ... 得到 ${filename}`);
        return { path: filename, content };
      } catch (e) {
        //
      }
    }

    throw Error(`无法于 "${ref}" 解析到 "${id}"`);
  }

  async init() {
    // 加载脚本
    const { path, content } = await this.resolveScript(this.path, this.referrer_path);
    this.resolved_path = path;
    this.runScript = compileContext(content);
    // 开始初始化
    _statusStack.push('MOUNT');
    _nodeStack.push(this);
    this.runScript();
    _nodeStack.pop();
    _statusStack.pop();
    for (const child of this.children) {
      await child.init();
    }
  }

  update() {
    _statusStack.push('UPDATE');
    _nodeStack.push(this);
    this.runScript();
    _nodeStack.pop();
    _statusStack.pop();
  }
}
