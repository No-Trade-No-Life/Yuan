declare module '@yuants/ui-web' {
  import { JSONSchema7 } from 'json-schema';
  import * as react_jsx_runtime from 'react/jsx-runtime';
  import * as React$1 from 'react';
  import React__default, { ComponentType, ReactNode } from 'react';
  import * as rxjs from 'rxjs';
  import { BehaviorSubject, ReplaySubject, Observable, Subject } from 'rxjs';
  import * as _yuants_data_account from '@yuants/data-account';
  import {
    ColumnDef,
    Table,
    SortingState,
    OnChangeFn,
    GroupingState,
    VisibilityState,
    ColumnFiltersState,
    ExpandedState,
  } from '@tanstack/react-table';
  import { ThemeProps, FormProps } from '@rjsf/core';
  import {
    StrictRJSFSchema,
    RJSFSchema,
    FormContextType,
    TemplatesType,
    RegistryWidgetsType,
    UiSchema,
  } from '@rjsf/utils';
  import { AutoCompleteProps } from '@douyinfe/semi-ui/lib/es/autoComplete';
  import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
  import { UniqueIdentifier } from '@dnd-kit/core';
  import { SwitchProps } from '@douyinfe/semi-ui/lib/es/switch';
  import { ToastReactProps } from '@douyinfe/semi-ui/lib/es/toast';
  import * as _yuants_protocol from '@yuants/protocol';
  import { Terminal } from '@yuants/protocol';
  import { IQuote } from '@yuants/data-quote';

  const schemaOfAccountComposerConfig: JSONSchema7;

  const index_d$A_schemaOfAccountComposerConfig: typeof schemaOfAccountComposerConfig;
  namespace index_d$A {
    export { index_d$A_schemaOfAccountComposerConfig as schemaOfAccountComposerConfig };
  }

  const AccountSelector: (props: {
    value: string;
    onChange: (v: string) => void;
    candidates: string[];
  }) => react_jsx_runtime.JSX.Element;

  const InlineAccountId: React__default.MemoExoticComponent<
    (props: { account_id: string }) => react_jsx_runtime.JSX.Element
  >;

  const useAccountInfo: (account_id: string) => rxjs.Observable<_yuants_data_account.IAccountInfo>;

  const index_d$z_AccountSelector: typeof AccountSelector;
  const index_d$z_InlineAccountId: typeof InlineAccountId;
  const index_d$z_useAccountInfo: typeof useAccountInfo;
  namespace index_d$z {
    export {
      index_d$z_AccountSelector as AccountSelector,
      index_d$z_InlineAccountId as InlineAccountId,
      index_d$z_useAccountInfo as useAccountInfo,
    };
  }

  namespace index_d$y {
    export {};
  }

  namespace index_d$x {
    export {};
  }

  namespace index_d$w {
    export {};
  }

  namespace index_d$v {
    export {};
  }

  const createPersistBehaviorSubject: <T>(key: string, initialValue: T) => BehaviorSubject<T | undefined>;

  /**
   * @public
   */
  const Launch: React__default.MemoExoticComponent<
    (props: { children: React__default.ReactNode }) => react_jsx_runtime.JSX.Element
  >;

  /**
   * A subject that emits a single value when the workspace is ready.
   * @public
   */
  const ready$: ReplaySubject<unknown>;
  const error$: ReplaySubject<unknown>;

  const index_d$u_Launch: typeof Launch;
  const index_d$u_createPersistBehaviorSubject: typeof createPersistBehaviorSubject;
  const index_d$u_error$: typeof error$;
  const index_d$u_ready$: typeof ready$;
  namespace index_d$u {
    export {
      index_d$u_Launch as Launch,
      index_d$u_createPersistBehaviorSubject as createPersistBehaviorSubject,
      index_d$u_error$ as error$,
      index_d$u_ready$ as ready$,
    };
  }

  namespace index_d$t {
    export {};
  }

  const registerCommand: (id: string, handler: (params: any) => void) => void;
  const executeCommand: (id: string, params?: {}) => Promise<void>;
  const CommandCenter: React__default.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

  const index_d$s_CommandCenter: typeof CommandCenter;
  const index_d$s_executeCommand: typeof executeCommand;
  const index_d$s_registerCommand: typeof registerCommand;
  namespace index_d$s {
    export {
      index_d$s_CommandCenter as CommandCenter,
      index_d$s_executeCommand as executeCommand,
      index_d$s_registerCommand as registerCommand,
    };
  }

  namespace index_d$r {
    export {};
  }

  namespace index_d$q {
    export {};
  }

  const useValue: <T>(id: string, initialValue: T) => [T, (v: T) => void];

  const index_d$p_useValue: typeof useValue;
  namespace index_d$p {
    export { index_d$p_useValue as useValue };
  }

  interface IDataRecordViewDef<T extends {}> {
    conflictKeys?: (keyof T)[];
    TYPE: string;
    columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<T, any>[];
    extraRecordActions?: React__default.ComponentType<{
      reloadData: () => Promise<void>;
      record: T;
    }>;
    extraHeaderActions?: React__default.ComponentType<{}>;
    newRecord?: () => Partial<T>;
    beforeUpdateTrigger?: (x: T) => void | Promise<void>;
    schema?: JSONSchema7;
  }
  /**
   * General Data Record View
   */
  function DataRecordView<T extends {}>(props: IDataRecordViewDef<T>): react_jsx_runtime.JSX.Element;

  const index_d$o_DataRecordView: typeof DataRecordView;
  namespace index_d$o {
    export { index_d$o_DataRecordView as DataRecordView };
  }

  namespace index_d$n {
    export {};
  }

  namespace index_d$m {
    export {};
  }

  const DesktopLayout: () => react_jsx_runtime.JSX.Element | null;

  const activePage$: rxjs.Observable<
    | {
        page: string;
        pageParams: any;
      }
    | undefined
  >;

  const index_d$l_DesktopLayout: typeof DesktopLayout;
  const index_d$l_activePage$: typeof activePage$;
  namespace index_d$l {
    export { index_d$l_DesktopLayout as DesktopLayout, index_d$l_activePage$ as activePage$ };
  }

  namespace index_d$k {
    export {};
  }

  interface INpmPackagePullParams {
    name: string;
    registry?: string;
    version?: string;
    npm_token?: string;
  }
  const loadTgzBlob: (tgzBlob: Blob) => Promise<
    {
      filename: string;
      blob: Blob;
      isDirectory: boolean;
      isFile: boolean;
    }[]
  >;
  function resolveVersion(context: INpmPackagePullParams): Promise<{
    meta: any;
    version: string;
  }>;

  const index_d$j_loadTgzBlob: typeof loadTgzBlob;
  const index_d$j_resolveVersion: typeof resolveVersion;
  namespace index_d$j {
    export { index_d$j_loadTgzBlob as loadTgzBlob, index_d$j_resolveVersion as resolveVersion };
  }

  interface IFileSystemStatResult {
    isFile: () => boolean;
    isDirectory: () => boolean;
  }
  interface IFileSystemBackend {
    name: string;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<IFileSystemStatResult>;
    readFile(path: string): Promise<string>;
    readFileAsBase64(path: string): Promise<string>;
    readFileAsBlob(path: string): Promise<Blob>;
    writeFile(path: string, content: FileSystemWriteChunkType): Promise<void>;
    createReadableStream(path: string): Promise<ReadableStream>;
    createWritableStream(path: string): Promise<WritableStream>;
    mkdir(path: string): Promise<void>;
    rm(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    ensureDir(path: string): Promise<void>;
  }

  const FsBackend$: BehaviorSubject<IFileSystemBackend>;
  const fs: IFileSystemBackend;

  /**
   * Bundle code from entry
   * @param entry entry filename
   * @returns IIFE-formatted code
   * @public
   */
  const bundleCode: (entry: string, externals: string[]) => Promise<string>;

  const createFileSystemBehaviorSubject: <T>(key: string, initialValue: T) => BehaviorSubject<T | undefined>;

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
    paths?:
      | string[]
      | ((request: string, start: string, getPaths: () => string[], opts: IOptions) => string[]);
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
  function resolve(x: string, options: IOptions): Promise<string>;

  const index_d$i_FsBackend$: typeof FsBackend$;
  const index_d$i_bundleCode: typeof bundleCode;
  const index_d$i_createFileSystemBehaviorSubject: typeof createFileSystemBehaviorSubject;
  const index_d$i_fs: typeof fs;
  const index_d$i_resolve: typeof resolve;
  namespace index_d$i {
    export {
      index_d$i_FsBackend$ as FsBackend$,
      index_d$i_bundleCode as bundleCode,
      index_d$i_createFileSystemBehaviorSubject as createFileSystemBehaviorSubject,
      index_d$i_fs as fs,
      index_d$i_resolve as resolve,
    };
  }

  function generateTemplates<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any,
  >(): Partial<TemplatesType<T, S, F>>;
  const _default$1: Partial<TemplatesType<any, RJSFSchema, any>>;

  function generateWidgets<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any,
  >(): RegistryWidgetsType<T, S, F>;
  const _default: RegistryWidgetsType<any, RJSFSchema, any>;

  function generateTheme<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any,
  >(): ThemeProps<T, S, F>;
  const Theme: ThemeProps<any, RJSFSchema, any>;
  function generateForm<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any,
  >(): ComponentType<FormProps<T, S, F>>;
  const Form: (
    props: Omit<FormProps<any, any, any>, 'validator'>,
  ) => React__default.ReactElement<
    FormProps<any, RJSFSchema, any>,
    string | React__default.JSXElementConstructor<any>
  >;

  /**
   * Request user to input data according to the schema.
   * @param schema - JSON Schema (https://json-schema.org/)
   * @param initialData - Initial data to be filled in the form
   * @returns Promise of user input data
   */
  const showForm: <T>(
    schema: JSONSchema7,
    initialData?: any,
    options?: {
      /**
       * Whether to submit the form immediately if the initial data is valid.
       * if set to true, the form will be submitted immediately without showing the form.
       * if initial data is invalid, the form will be shown as usual.
       */
      immediateSubmit?: boolean;
      uiSchema?: UiSchema<T, any, any>;
    },
  ) => Promise<T>;

  const index_d$h_Form: typeof Form;
  const index_d$h_Theme: typeof Theme;
  const index_d$h_generateForm: typeof generateForm;
  const index_d$h_generateTemplates: typeof generateTemplates;
  const index_d$h_generateTheme: typeof generateTheme;
  const index_d$h_generateWidgets: typeof generateWidgets;
  const index_d$h_showForm: typeof showForm;
  namespace index_d$h {
    export {
      index_d$h_Form as Form,
      _default$1 as Templates,
      index_d$h_Theme as Theme,
      _default as Widgets,
      Form as default,
      index_d$h_generateForm as generateForm,
      index_d$h_generateTemplates as generateTemplates,
      index_d$h_generateTheme as generateTheme,
      index_d$h_generateWidgets as generateWidgets,
      index_d$h_showForm as showForm,
    };
  }

  namespace index_d$g {
    export {};
  }

  function AutoComplete(
    props: Omit<
      AutoCompleteProps<{
        label: string;
        value: string;
      }>,
      'value' | 'onChange'
    > & {
      value: string;
      onChange: (value: string) => void;
    },
  ): react_jsx_runtime.JSX.Element;

  /**
   * Yuan Button Component
   *
   * - Button must display loading status after clicking
   * - Button displays loading if and only if click event processing
   * - We need to know whether the backend click event is processing or not.
   */
  const Button: React__default.MemoExoticComponent<
    (
      props: Omit<ButtonProps, 'onClick' | 'loading'> & {
        onClick?: () => any;
        doubleCheck?: {
          title: React__default.ReactNode;
          description?: React__default.ReactNode;
        };
      },
    ) => react_jsx_runtime.JSX.Element
  >;

  function DataView<T, K>(props: {
    data?: T[];
    columns: ColumnDef<T, any>[];
    columnsDependencyList?: any[];
    tableRef?: React.MutableRefObject<Table<T> | undefined>;
    layoutMode?: 'table' | 'list' | 'auto';
    topSlot?: React.ReactNode;
    initialSorting?: SortingState;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    manualSorting?: boolean;
    manualPagination?: boolean;
    initialGroupping?: GroupingState;
    initialColumnVisibility?: VisibilityState;
    initialColumnFilterState?: ColumnFiltersState;
    columnFilters?: ColumnFiltersState;
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
    initialTopSlotVisible?: boolean;
    topSlotVisible?: boolean;
    isLoading?: boolean;
    initialPageSize?: number;
    CustomView?: React.ComponentType<{
      table: Table<T>;
    }>;
    enableAutoPause?: boolean;
    pageCount?: number;
    totalCount?: number;
    hideGroup?: boolean;
    hideFieldSettings?: boolean;
    hideExport?: boolean;
  }): react_jsx_runtime.JSX.Element;

  interface Props {
    data: Array<{
      key: string | ReactNode;
      value: string | ReactNode;
      suffix?: string | ReactNode;
      prefix?: string | ReactNode;
    }>;
    minColumnWidth?: number;
  }
  const Description: (props: Props) => react_jsx_runtime.JSX.Element;

  /**
   * 人类易读的数字格式
   */
  const InlineNumber: (props: { number: number | string }) => react_jsx_runtime.JSX.Element;

  /**
   * 显示某个时间点距离现在的大约时间间隔
   *
   * 悬浮显示完整时间
   *
   * @remarks
   * 人类普遍习惯使用相对时间来表示时间点，例如 "5分钟前"、"2小时前"、"3天前" 等等。
   * 这种表示方式更符合人类的时间感知，有助于用户快速理解时间点的相对位置。
   * 此外，悬浮显示完整时间可以在用户需要时提供精确的时间信息，满足不同场景下的需求。
   *
   */
  const InlineTime: (props: { time: number | string | Date }) => react_jsx_runtime.JSX.Element;

  function ListView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  interface IPivotTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    initialGrouping?: GroupingState;
    initialExpanded?: ExpandedState;
  }
  function PivotTable<T>(props: IPivotTableProps<T>): react_jsx_runtime.JSX.Element;

  const SortableList: (props: {
    items: UniqueIdentifier[];
    render: (item: UniqueIdentifier) => React.ReactNode;
    onSort: (items: UniqueIdentifier[]) => void;
  }) => react_jsx_runtime.JSX.Element;

  /**
   * Yuan Switch Component
   *
   * - Switch must display loading status after clicking
   * - Switch displays loading if and only if click event processing
   * - We need to know whether the backend click event is processing or not.
   */
  const Switch: React__default.MemoExoticComponent<
    (
      props: Omit<SwitchProps, 'onChange' | 'loading'> & {
        onChange?: (checked: boolean) => any;
      },
    ) => react_jsx_runtime.JSX.Element
  >;

  function TableView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  type ToastProps = string | Omit<ToastReactProps, 'type'>;
  /**
   * Yuan Toast Component
   */
  const Toast: {
    info: (props: ToastProps) => string;
    error: (props: ToastProps) => string;
    success: (props: ToastProps) => string;
    warning: (props: ToastProps) => string;
    close: (id: string) => void;
  };

  const index_d$f_AutoComplete: typeof AutoComplete;
  const index_d$f_Button: typeof Button;
  const index_d$f_DataView: typeof DataView;
  const index_d$f_Description: typeof Description;
  type index_d$f_IPivotTableProps<T> = IPivotTableProps<T>;
  const index_d$f_InlineNumber: typeof InlineNumber;
  const index_d$f_InlineTime: typeof InlineTime;
  const index_d$f_ListView: typeof ListView;
  const index_d$f_PivotTable: typeof PivotTable;
  const index_d$f_SortableList: typeof SortableList;
  const index_d$f_Switch: typeof Switch;
  const index_d$f_TableView: typeof TableView;
  const index_d$f_Toast: typeof Toast;
  type index_d$f_ToastProps = ToastProps;
  namespace index_d$f {
    export {
      index_d$f_AutoComplete as AutoComplete,
      index_d$f_Button as Button,
      index_d$f_DataView as DataView,
      index_d$f_Description as Description,
      type index_d$f_IPivotTableProps as IPivotTableProps,
      index_d$f_InlineNumber as InlineNumber,
      index_d$f_InlineTime as InlineTime,
      index_d$f_ListView as ListView,
      index_d$f_PivotTable as PivotTable,
      index_d$f_SortableList as SortableList,
      index_d$f_Switch as Switch,
      index_d$f_TableView as TableView,
      index_d$f_Toast as Toast,
      type index_d$f_ToastProps as ToastProps,
    };
  }

  namespace index_d$e {
    export {};
  }

  namespace index_d$d {
    export {};
  }

  const hostUrl$: BehaviorSubject<string | null>;
  const terminal$: Observable<Terminal | null>;

  const index_d$c_hostUrl$: typeof hostUrl$;
  const index_d$c_terminal$: typeof terminal$;
  namespace index_d$c {
    export { index_d$c_hostUrl$ as hostUrl$, index_d$c_terminal$ as terminal$ };
  }

  const seriesIdList$: rxjs.Observable<string[]>;

  const index_d$b_seriesIdList$: typeof seriesIdList$;
  namespace index_d$b {
    export { index_d$b_seriesIdList$ as seriesIdList$ };
  }

  interface IInterleavingConfigItem {
    account_id: string;
    datasource_id: string;
    product_id: string;
    order_type: string;
    order_direction: string;
    volume: number;
    disabled?: boolean;
  }
  interface IInterleavingConfig {
    count: number;
    items: IInterleavingConfigItem[];
  }
  const InterleavingTraderConfig$: BehaviorSubject<IInterleavingConfig | undefined>;

  type index_d$a_IInterleavingConfig = IInterleavingConfig;
  type index_d$a_IInterleavingConfigItem = IInterleavingConfigItem;
  const index_d$a_InterleavingTraderConfig$: typeof InterleavingTraderConfig$;
  namespace index_d$a {
    export {
      type index_d$a_IInterleavingConfig as IInterleavingConfig,
      type index_d$a_IInterleavingConfigItem as IInterleavingConfigItem,
      index_d$a_InterleavingTraderConfig$ as InterleavingTraderConfig$,
    };
  }

  class ErrorBoundary extends React__default.Component<{
    fallback?: React__default.ComponentType<{
      error: any;
      reset: () => void;
    }>;
    children: React__default.ReactNode;
  }> {
    state: {
      hasError: boolean;
      error: null;
    };
    static getDerivedStateFromError(error: any): {
      hasError: boolean;
      error: any;
    };
    render():
      | string
      | number
      | boolean
      | Iterable<React__default.ReactNode>
      | react_jsx_runtime.JSX.Element
      | null
      | undefined;
  }
  const DefaultErrorFallback: ({
    error,
    reset,
  }: {
    error: any;
    reset: () => void;
  }) => react_jsx_runtime.JSX.Element;

  const LocalizePageTitle: React__default.ComponentType<{
    type: string;
    params?: any;
  }>;

  const AvailableComponents: Record<string, React__default.ComponentType>;
  const pageRegistered$: Subject<string>;
  const registerPage: (type: string, component: React__default.ComponentType) => void;

  interface IPage {
    id: string;
    type: string;
    params: any;
    viewport: {
      w: number;
      h: number;
      x: number;
      y: number;
    };
  }
  const Page: React__default.MemoExoticComponent<(props: { page: IPage }) => react_jsx_runtime.JSX.Element>;
  const usePageParams: <T = any>() => T;
  const usePageTitle: (title: string) => void;
  const usePageType: () => string;
  const usePageViewport: () =>
    | {
        w: number;
        h: number;
        x: number;
        y: number;
      }
    | undefined;
  const usePageId: () => string;

  const index_d$9_AvailableComponents: typeof AvailableComponents;
  const index_d$9_DefaultErrorFallback: typeof DefaultErrorFallback;
  type index_d$9_ErrorBoundary = ErrorBoundary;
  const index_d$9_ErrorBoundary: typeof ErrorBoundary;
  const index_d$9_LocalizePageTitle: typeof LocalizePageTitle;
  const index_d$9_Page: typeof Page;
  const index_d$9_pageRegistered$: typeof pageRegistered$;
  const index_d$9_registerPage: typeof registerPage;
  const index_d$9_usePageId: typeof usePageId;
  const index_d$9_usePageParams: typeof usePageParams;
  const index_d$9_usePageTitle: typeof usePageTitle;
  const index_d$9_usePageType: typeof usePageType;
  const index_d$9_usePageViewport: typeof usePageViewport;
  namespace index_d$9 {
    export {
      index_d$9_AvailableComponents as AvailableComponents,
      index_d$9_DefaultErrorFallback as DefaultErrorFallback,
      index_d$9_ErrorBoundary as ErrorBoundary,
      index_d$9_LocalizePageTitle as LocalizePageTitle,
      index_d$9_Page as Page,
      index_d$9_pageRegistered$ as pageRegistered$,
      index_d$9_registerPage as registerPage,
      index_d$9_usePageId as usePageId,
      index_d$9_usePageParams as usePageParams,
      index_d$9_usePageTitle as usePageTitle,
      index_d$9_usePageType as usePageType,
      index_d$9_usePageViewport as usePageViewport,
    };
  }

  namespace index_d$8 {
    export {};
  }

  namespace index_d$7 {
    export {};
  }

  /**
   * File is associated with Command
   */
  interface IAssociationRule {
    /** i18n_key = `association:${id}`  */
    id: string;
    priority?: number;
    match: (ctx: { path: string; isFile: boolean }) => boolean;
    action: (ctx: { path: string; isFile: boolean }) => void;
  }
  const registerAssociationRule: (rule: IAssociationRule) => void;
  const executeAssociatedRule: (filename: string, rule_index?: number) => Promise<void>;
  const associationRules: IAssociationRule[];

  type index_d$6_IAssociationRule = IAssociationRule;
  const index_d$6_associationRules: typeof associationRules;
  const index_d$6_executeAssociatedRule: typeof executeAssociatedRule;
  const index_d$6_registerAssociationRule: typeof registerAssociationRule;
  namespace index_d$6 {
    export {
      type index_d$6_IAssociationRule as IAssociationRule,
      index_d$6_associationRules as associationRules,
      index_d$6_executeAssociatedRule as executeAssociatedRule,
      index_d$6_registerAssociationRule as registerAssociationRule,
    };
  }

  const InlineTerminalId: (props: { terminal_id: string }) => react_jsx_runtime.JSX.Element;

  const useTerminal: () => _yuants_protocol.Terminal | null | undefined;

  const isTerminalConnected$: rxjs.Observable<boolean>;

  const useTick: (datasource_id: string, product_id: string) => rxjs.Observable<IQuote>;

  const index_d$5_InlineTerminalId: typeof InlineTerminalId;
  const index_d$5_hostUrl$: typeof hostUrl$;
  const index_d$5_isTerminalConnected$: typeof isTerminalConnected$;
  const index_d$5_terminal$: typeof terminal$;
  const index_d$5_useTerminal: typeof useTerminal;
  const index_d$5_useTick: typeof useTick;
  namespace index_d$5 {
    export {
      index_d$5_InlineTerminalId as InlineTerminalId,
      index_d$5_hostUrl$ as hostUrl$,
      index_d$5_isTerminalConnected$ as isTerminalConnected$,
      index_d$5_terminal$ as terminal$,
      index_d$5_useTerminal as useTerminal,
      index_d$5_useTick as useTick,
    };
  }

  /**
   * @public
   */
  interface ITradeCopierTradeConfig {
    id?: string;
    account_id: string;
    product_id: string;
    max_volume_per_order: number;
    limit_order_control?: boolean;
    disabled?: boolean;
  }
  /**
   * @public
   */
  interface ITradeCopyRelation {
    id?: string;
    source_account_id: string;
    source_product_id: string;
    target_account_id: string;
    target_product_id: string;
    multiple: number;
    /** 根据正则表达式匹配头寸的备注 (黑名单) */
    exclusive_comment_pattern?: string;
    disabled?: boolean;
  }
  type ITradeCopierStrategyBase = {
    /**
     * 策略类型
     */
    type?: string;
    /**
     * 最大订单量限制
     */
    max_volume?: number;
  };
  type ITradeCopierStrategyConfig = {
    /**
     * 全局默认配置
     */
    global?: ITradeCopierStrategyBase;
    /**
     * 按照 product 特殊覆盖的配置
     */
    product_overrides?: Record<string, ITradeCopierStrategyBase>;
  };
  /**
   * @public
   */
  interface ITradeCopierConfig {
    /**
     * 实际账户 ID
     *
     * - (强制) 预期账户 ID 格式: `TradeCopier/Expected/${account_id}`
     * - (建议) 预览账户 ID 格式: `TradeCopier/Preview/${account_id}`
     *
     * (防呆设计) 建议在使用时，先配置预览账户，确认无误后，再发布配置到预期账户。直接修改预期账户的配置，可能会导致跟单出现意外的问题。
     */
    account_id: string;
    /**
     * 是否启用跟单
     */
    enabled: boolean;
    /**
     * 跟单策略配置
     */
    strategy: ITradeCopierStrategyConfig;
    created_at: string;
    updated_at: string;
  }

  const schemaOfTradeCopierConfig: JSONSchema7;

  const TradeCopierDetail: React$1.MemoExoticComponent<
    (props: { account_id: string }) => react_jsx_runtime.JSX.Element
  >;

  type index_d$4_ITradeCopierConfig = ITradeCopierConfig;
  type index_d$4_ITradeCopierStrategyBase = ITradeCopierStrategyBase;
  type index_d$4_ITradeCopierStrategyConfig = ITradeCopierStrategyConfig;
  type index_d$4_ITradeCopierTradeConfig = ITradeCopierTradeConfig;
  type index_d$4_ITradeCopyRelation = ITradeCopyRelation;
  const index_d$4_TradeCopierDetail: typeof TradeCopierDetail;
  const index_d$4_schemaOfTradeCopierConfig: typeof schemaOfTradeCopierConfig;
  namespace index_d$4 {
    export {
      type index_d$4_ITradeCopierConfig as ITradeCopierConfig,
      type index_d$4_ITradeCopierStrategyBase as ITradeCopierStrategyBase,
      type index_d$4_ITradeCopierStrategyConfig as ITradeCopierStrategyConfig,
      type index_d$4_ITradeCopierTradeConfig as ITradeCopierTradeConfig,
      type index_d$4_ITradeCopyRelation as ITradeCopyRelation,
      index_d$4_TradeCopierDetail as TradeCopierDetail,
      index_d$4_schemaOfTradeCopierConfig as schemaOfTradeCopierConfig,
    };
  }

  namespace index_d$3 {
    export {};
  }

  namespace index_d$2 {
    export {};
  }

  const CSV: {
    escapeCellValue: (cell: any) => string;
    readFile: <T = any>(filename: string) => Promise<T[]>;
    writeFile: (filename: string, data: any[]) => Promise<void>;
    /**
     * 通过原始表格数据写入 CSV 文件
     * @param filename 写入的文件名
     * @param data 原始表格数据
     * @param transpose 是否转置数据 (行列互换), 默认不转置
     */
    writeFileFromRawTable: (filename: string, data: any[][], transpose?: boolean) => Promise<void>;
    parse: <T = any>(csvString: string) => T[];
    stringify: (data: any[]) => string;
  };

  const ZIP: {
    read: (zipFileBlob: Blob) => Promise<
      {
        filename: string;
        blob: Blob;
        isDirectory: boolean;
        isFile: boolean;
      }[]
    >;
  };

  const index_d$1_CSV: typeof CSV;
  const index_d$1_ZIP: typeof ZIP;
  namespace index_d$1 {
    export { index_d$1_CSV as CSV, index_d$1_ZIP as ZIP };
  }

  const isShowHome$: rxjs.BehaviorSubject<boolean | undefined>;
  const toggleShowHome: () => void;
  const HomePage: React__default.MemoExoticComponent<() => react_jsx_runtime.JSX.Element | null>;

  const DarkModeSetting$: rxjs.BehaviorSubject<'auto' | 'light' | 'dark' | undefined>;
  const isDarkMode$: Observable<boolean>;
  const useIsDarkMode: () => boolean;

  const DarkModeEffect: () => react_jsx_runtime.JSX.Element;

  const DarkmodeSwitch: React__default.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

  /**
   * Hook to use the page closing confirm
   *
   * usePageClosingConfirm hook is used to show a confirmation dialog when the user tries to close/refresh the page.
   *
   * recommend to use this hook in the component where you want to show the confirmation dialog.
   *
   * for example, some component with complex form data that the user might lose if they close the page.
   */
  const usePageClosingConfirm: (disabled?: boolean) => void;

  const FullScreenButton: () => react_jsx_runtime.JSX.Element;

  const network$: rxjs.Observable<string[]>;

  interface IHostConfigItem {
    name: string;
    host_url: string;
  }
  const hostConfigList$: rxjs.BehaviorSubject<IHostConfigItem[] | undefined>;
  const currentHostConfig$: rxjs.BehaviorSubject<IHostConfigItem | null | undefined>;
  const initAction$: ReplaySubject<{
    type: string;
    payload: any;
  }>;

  const index_d_DarkModeEffect: typeof DarkModeEffect;
  const index_d_DarkModeSetting$: typeof DarkModeSetting$;
  const index_d_DarkmodeSwitch: typeof DarkmodeSwitch;
  const index_d_FullScreenButton: typeof FullScreenButton;
  const index_d_HomePage: typeof HomePage;
  type index_d_IHostConfigItem = IHostConfigItem;
  const index_d_currentHostConfig$: typeof currentHostConfig$;
  const index_d_hostConfigList$: typeof hostConfigList$;
  const index_d_initAction$: typeof initAction$;
  const index_d_isDarkMode$: typeof isDarkMode$;
  const index_d_isShowHome$: typeof isShowHome$;
  const index_d_network$: typeof network$;
  const index_d_toggleShowHome: typeof toggleShowHome;
  const index_d_useIsDarkMode: typeof useIsDarkMode;
  const index_d_usePageClosingConfirm: typeof usePageClosingConfirm;
  namespace index_d {
    export {
      index_d_DarkModeEffect as DarkModeEffect,
      index_d_DarkModeSetting$ as DarkModeSetting$,
      index_d_DarkmodeSwitch as DarkmodeSwitch,
      index_d_FullScreenButton as FullScreenButton,
      index_d_HomePage as HomePage,
      type index_d_IHostConfigItem as IHostConfigItem,
      index_d_currentHostConfig$ as currentHostConfig$,
      index_d_hostConfigList$ as hostConfigList$,
      index_d_initAction$ as initAction$,
      index_d_isDarkMode$ as isDarkMode$,
      index_d_isShowHome$ as isShowHome$,
      index_d_network$ as network$,
      index_d_toggleShowHome as toggleShowHome,
      index_d_useIsDarkMode as useIsDarkMode,
      index_d_usePageClosingConfirm as usePageClosingConfirm,
    };
  }

  export {
    index_d$A as AccountComposition,
    index_d$z as AccountInfo,
    index_d$y as AccountRiskInfo,
    index_d$x as Agent,
    index_d$w as Alert,
    index_d$v as Audit,
    index_d$u as BIOS,
    index_d$t as Chart,
    index_d$s as CommandCenter,
    index_d$r as Copilot,
    index_d$q as CryptoTool,
    index_d$p as Data,
    index_d$o as DataRecord,
    index_d$n as DataSeries,
    index_d$m as Deploy,
    index_d$l as DesktopLayout,
    index_d$k as Editor,
    index_d$j as Extensions,
    index_d$i as FileSystem,
    index_d$h as Form,
    index_d$g as Fund,
    index_d$f as Interactive,
    index_d$e as Kernel,
    index_d$d as Market,
    index_d$c as Network,
    index_d$b as OHLC,
    index_d$a as Order,
    index_d$9 as Pages,
    index_d$8 as Products,
    index_d$7 as SQL,
    index_d$6 as System,
    index_d$5 as Terminals,
    index_d$4 as TradeCopier,
    index_d$3 as TradingBoard,
    index_d$2 as TransferOrder,
    index_d$1 as Util,
    index_d as Workbench,
  };
}
