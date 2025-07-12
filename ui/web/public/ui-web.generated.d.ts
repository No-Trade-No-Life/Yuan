declare module '@yuants/ui-web' {
  /// <reference types="react" />
  import * as react_jsx_runtime from 'react/jsx-runtime';
  import React$1, { ComponentType } from 'react';
  import * as rxjs from 'rxjs';
  import { BehaviorSubject, ReplaySubject, Subject, Observable } from 'rxjs';
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
  import { JSONSchema7 } from 'json-schema';
  import { ThemeProps, FormProps } from '@rjsf/core';
  import {
    StrictRJSFSchema,
    RJSFSchema,
    FormContextType,
    TemplatesType,
    RegistryWidgetsType,
    UiSchema,
  } from '@rjsf/utils';
  import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
  import { ToastReactProps } from '@douyinfe/semi-ui/lib/es/toast';
  import * as _supabase_supabase_js from '@supabase/supabase-js';
  import { User } from '@supabase/supabase-js';
  import { ITick } from '@yuants/data-model';
  import { Terminal } from '@yuants/protocol';

  namespace index_d$w {
    export {};
  }

  const AccountSelector: (props: {
    value: string;
    onChange: (v: string) => void;
    candidates: string[];
  }) => react_jsx_runtime.JSX.Element;

  const InlineAccountId: React$1.MemoExoticComponent<
    (props: { account_id: string }) => react_jsx_runtime.JSX.Element
  >;

  const useAccountInfo: (account_id: string) => rxjs.Observable<_yuants_data_account.IAccountInfo>;

  const index_d$v_AccountSelector: typeof AccountSelector;
  const index_d$v_InlineAccountId: typeof InlineAccountId;
  const index_d$v_useAccountInfo: typeof useAccountInfo;
  namespace index_d$v {
    export {
      index_d$v_AccountSelector as AccountSelector,
      index_d$v_InlineAccountId as InlineAccountId,
      index_d$v_useAccountInfo as useAccountInfo,
    };
  }

  namespace index_d$u {
    export {};
  }

  namespace index_d$t {
    export {};
  }

  const createPersistBehaviorSubject: <T>(key: string, initialValue: T) => BehaviorSubject<T | undefined>;

  /**
   * A subject that emits a single value when the workspace is ready.
   * @public
   */
  const ready$: ReplaySubject<unknown>;
  const error$: ReplaySubject<unknown>;

  const index_d$s_createPersistBehaviorSubject: typeof createPersistBehaviorSubject;
  const index_d$s_error$: typeof error$;
  const index_d$s_ready$: typeof ready$;
  namespace index_d$s {
    export {
      index_d$s_createPersistBehaviorSubject as createPersistBehaviorSubject,
      index_d$s_error$ as error$,
      index_d$s_ready$ as ready$,
    };
  }

  namespace index_d$r {
    export {};
  }

  const registerCommand: (id: string, handler: (params: any) => void) => void;
  const executeCommand: (id: string, params?: {}) => Promise<void>;
  const CommandCenter: React$1.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

  const index_d$q_CommandCenter: typeof CommandCenter;
  const index_d$q_executeCommand: typeof executeCommand;
  const index_d$q_registerCommand: typeof registerCommand;
  namespace index_d$q {
    export {
      index_d$q_CommandCenter as CommandCenter,
      index_d$q_executeCommand as executeCommand,
      index_d$q_registerCommand as registerCommand,
    };
  }

  namespace index_d$p {
    export {};
  }

  const useValue: <T>(id: string, initialValue: T) => [T, (v: T) => void];

  const index_d$o_useValue: typeof useValue;
  namespace index_d$o {
    export { index_d$o_useValue as useValue };
  }

  interface IDataRecordViewDef<T extends {}> {
    TYPE: string;
    columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<T, any>[];
    extraRecordActions?: React$1.ComponentType<{
      reloadData: () => Promise<void>;
      record: T;
    }>;
    extraHeaderActions?: React$1.ComponentType<{}>;
    newRecord?: () => Partial<T>;
    beforeUpdateTrigger?: (x: T) => void | Promise<void>;
    schema?: JSONSchema7;
  }
  /**
   * General Data Record View
   */
  function DataRecordView<T extends {}>(props: IDataRecordViewDef<T>): react_jsx_runtime.JSX.Element;

  const index_d$n_DataRecordView: typeof DataRecordView;
  namespace index_d$n {
    export { index_d$n_DataRecordView as DataRecordView };
  }

  namespace index_d$m {
    export {};
  }

  namespace index_d$l {
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

  const index_d$k_DesktopLayout: typeof DesktopLayout;
  const index_d$k_activePage$: typeof activePage$;
  namespace index_d$k {
    export { index_d$k_DesktopLayout as DesktopLayout, index_d$k_activePage$ as activePage$ };
  }

  namespace index_d$j {
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

  const index_d$i_loadTgzBlob: typeof loadTgzBlob;
  const index_d$i_resolveVersion: typeof resolveVersion;
  namespace index_d$i {
    export { index_d$i_loadTgzBlob as loadTgzBlob, index_d$i_resolveVersion as resolveVersion };
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
    mkdir(path: string): Promise<void>;
    rm(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  }

  const FsBackend$: ReplaySubject<IFileSystemBackend>;
  const fs: IFileSystemBackend & {
    ensureDir: (path: string) => Promise<void>;
  };

  /**
   * Bundle code from entry
   * @param entry entry filename
   * @returns IIFE-formatted code
   * @public
   */
  const bundleCode: (entry: string, externals: string[]) => Promise<string>;

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

  const index_d$h_FsBackend$: typeof FsBackend$;
  const index_d$h_bundleCode: typeof bundleCode;
  const index_d$h_fs: typeof fs;
  const index_d$h_resolve: typeof resolve;
  namespace index_d$h {
    export {
      index_d$h_FsBackend$ as FsBackend$,
      index_d$h_bundleCode as bundleCode,
      index_d$h_fs as fs,
      index_d$h_resolve as resolve,
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
  ) => React$1.ReactElement<FormProps<any, RJSFSchema, any>, string | React$1.JSXElementConstructor<any>>;

  /**
   * Request user to input data according to the schema.
   * @param schema - JSON Schema (https://json-schema.org/)
   * @param initialData - Initial data to be filled in the form
   * @returns Promise of user input data
   */
  const showForm: <T>(
    schema: JSONSchema7,
    initialData?: any,
    options?:
      | {
          /**
           * Whether to submit the form immediately if the initial data is valid.
           * if set to true, the form will be submitted immediately without showing the form.
           * if initial data is invalid, the form will be shown as usual.
           */
          immediateSubmit?: boolean | undefined;
          uiSchema?: UiSchema<T, any, any> | undefined;
        }
      | undefined,
  ) => Promise<T>;

  const index_d$g_Form: typeof Form;
  const index_d$g_Theme: typeof Theme;
  const index_d$g_generateForm: typeof generateForm;
  const index_d$g_generateTemplates: typeof generateTemplates;
  const index_d$g_generateTheme: typeof generateTheme;
  const index_d$g_generateWidgets: typeof generateWidgets;
  const index_d$g_showForm: typeof showForm;
  namespace index_d$g {
    export {
      index_d$g_Form as Form,
      _default$1 as Templates,
      index_d$g_Theme as Theme,
      _default as Widgets,
      Form as default,
      index_d$g_generateForm as generateForm,
      index_d$g_generateTemplates as generateTemplates,
      index_d$g_generateTheme as generateTheme,
      index_d$g_generateWidgets as generateWidgets,
      index_d$g_showForm as showForm,
    };
  }

  namespace index_d$f {
    export {};
  }

  /**
   * Yuan Button Component
   *
   * - Button must display loading status after clicking
   * - Button displays loading if and only if click event processing
   * - We need to know whether the backend click event is processing or not.
   */
  const Button: React$1.MemoExoticComponent<
    (
      props: Omit<ButtonProps, 'onClick' | 'loading'> & {
        onClick: () => Promise<any>;
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
  }): react_jsx_runtime.JSX.Element;

  function ListView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  interface IPivotTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    initialGrouping?: GroupingState;
    initialExpanded?: ExpandedState;
  }
  function PivotTable<T>(props: IPivotTableProps<T>): react_jsx_runtime.JSX.Element;

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

  const index_d$e_Button: typeof Button;
  const index_d$e_DataView: typeof DataView;
  type index_d$e_IPivotTableProps<T> = IPivotTableProps<T>;
  const index_d$e_ListView: typeof ListView;
  const index_d$e_PivotTable: typeof PivotTable;
  const index_d$e_TableView: typeof TableView;
  const index_d$e_Toast: typeof Toast;
  type index_d$e_ToastProps = ToastProps;
  namespace index_d$e {
    export {
      index_d$e_Button as Button,
      index_d$e_DataView as DataView,
      type index_d$e_IPivotTableProps as IPivotTableProps,
      index_d$e_ListView as ListView,
      index_d$e_PivotTable as PivotTable,
      index_d$e_TableView as TableView,
      index_d$e_Toast as Toast,
      type index_d$e_ToastProps as ToastProps,
    };
  }

  namespace index_d$d {
    export {};
  }

  /**
   * @public
   */
  const Launch: React$1.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

  const index_d$c_Launch: typeof Launch;
  namespace index_d$c {
    export { index_d$c_Launch as Launch };
  }

  namespace index_d$b {
    export {};
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

  class ErrorBoundary extends React$1.Component<{
    fallback?: React$1.ComponentType<{
      error: any;
      reset: () => void;
    }>;
    children: React$1.ReactNode;
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
      | react_jsx_runtime.JSX.Element
      | Iterable<React$1.ReactNode>
      | null
      | undefined;
  }

  const LocalizePageTitle: React$1.ComponentType<{
    type: string;
    params?: any;
  }>;

  const AvailableComponents: Record<string, React$1.ComponentType>;
  const pageRegistered$: Subject<string>;
  const registerPage: (type: string, component: React$1.ComponentType) => void;

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
  const Page: React$1.MemoExoticComponent<(props: { page: IPage }) => react_jsx_runtime.JSX.Element>;
  const usePageParams: () => any;
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

  const supabase: _supabase_supabase_js.SupabaseClient<any, 'public', any>;
  const authState$: BehaviorSubject<
    | {
        user: User;
        refresh_token: string;
        access_token: string;
      }
    | undefined
  >;

  const index_d$6_authState$: typeof authState$;
  const index_d$6_supabase: typeof supabase;
  namespace index_d$6 {
    export { index_d$6_authState$ as authState$, index_d$6_supabase as supabase };
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

  type index_d$5_IAssociationRule = IAssociationRule;
  const index_d$5_associationRules: typeof associationRules;
  const index_d$5_executeAssociatedRule: typeof executeAssociatedRule;
  const index_d$5_registerAssociationRule: typeof registerAssociationRule;
  namespace index_d$5 {
    export {
      type index_d$5_IAssociationRule as IAssociationRule,
      index_d$5_associationRules as associationRules,
      index_d$5_executeAssociatedRule as executeAssociatedRule,
      index_d$5_registerAssociationRule as registerAssociationRule,
    };
  }

  const InlineTerminalId: (props: { terminal_id: string }) => react_jsx_runtime.JSX.Element;

  const terminal$: Observable<Terminal | null>;
  const useTerminal: () => Terminal | null | undefined;

  const isTerminalConnnected$: rxjs.Observable<boolean>;

  const useTick: (datasource_id: string, product_id: string) => rxjs.Observable<ITick>;

  const index_d$4_InlineTerminalId: typeof InlineTerminalId;
  const index_d$4_isTerminalConnnected$: typeof isTerminalConnnected$;
  const index_d$4_terminal$: typeof terminal$;
  const index_d$4_useTerminal: typeof useTerminal;
  const index_d$4_useTick: typeof useTick;
  namespace index_d$4 {
    export {
      index_d$4_InlineTerminalId as InlineTerminalId,
      index_d$4_isTerminalConnnected$ as isTerminalConnnected$,
      index_d$4_terminal$ as terminal$,
      index_d$4_useTerminal as useTerminal,
      index_d$4_useTick as useTick,
    };
  }

  namespace index_d$3 {
    export {};
  }

  namespace index_d$2 {
    export {};
  }

  const ensureAuthenticated: () => Promise<void>;

  const index_d$1_ensureAuthenticated: typeof ensureAuthenticated;
  namespace index_d$1 {
    export { index_d$1_ensureAuthenticated as ensureAuthenticated };
  }

  const isShowHome$: rxjs.BehaviorSubject<boolean | undefined>;
  const toggleShowHome: () => void;
  const HomePage: React$1.MemoExoticComponent<() => react_jsx_runtime.JSX.Element | null>;

  const DarkModeSetting$: rxjs.BehaviorSubject<'auto' | 'light' | 'dark' | undefined>;
  const isDarkMode$: Observable<boolean>;
  const useIsDarkMode: () => boolean;

  const DarkModeEffect: () => react_jsx_runtime.JSX.Element;

  const DarkmodeSwitch: React$1.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

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

  interface ICryptoHostConfig {
    label: string;
    public_key: string;
    private_key: string;
    host_url: string;
  }
  const cryptoHosts$: rxjs.BehaviorSubject<ICryptoHostConfig[] | undefined>;
  const network$: rxjs.Observable<string[]>;

  interface IHostConfigItem {
    name: string;
    host_url: string;
  }
  const hostConfigList$: BehaviorSubject<IHostConfigItem[] | undefined>;
  const currentHostConfig$: BehaviorSubject<IHostConfigItem | null | undefined>;
  const initAction$: ReplaySubject<{
    type: string;
    payload: any;
  }>;
  const OHLCIdList$: BehaviorSubject<string[]>;

  const index_d_DarkModeEffect: typeof DarkModeEffect;
  const index_d_DarkModeSetting$: typeof DarkModeSetting$;
  const index_d_DarkmodeSwitch: typeof DarkmodeSwitch;
  const index_d_FullScreenButton: typeof FullScreenButton;
  const index_d_HomePage: typeof HomePage;
  type index_d_IHostConfigItem = IHostConfigItem;
  const index_d_OHLCIdList$: typeof OHLCIdList$;
  const index_d_cryptoHosts$: typeof cryptoHosts$;
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
      index_d_OHLCIdList$ as OHLCIdList$,
      index_d_cryptoHosts$ as cryptoHosts$,
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
    index_d$w as AccountComposition,
    index_d$v as AccountInfo,
    index_d$u as AccountRiskInfo,
    index_d$t as Agent,
    index_d$s as BIOS,
    index_d$r as Chart,
    index_d$q as CommandCenter,
    index_d$p as Copilot,
    index_d$o as Data,
    index_d$n as DataRecord,
    index_d$m as DataSeries,
    index_d$l as Deploy,
    index_d$k as DesktopLayout,
    index_d$j as Editor,
    index_d$i as Extensions,
    index_d$h as FileSystem,
    index_d$g as Form,
    index_d$f as Fund,
    index_d$e as Interactive,
    index_d$d as Kernel,
    index_d$c as Launch,
    index_d$b as Market,
    index_d$a as Order,
    index_d$9 as Pages,
    index_d$8 as Products,
    index_d$7 as SQL,
    index_d$6 as SupaBase,
    index_d$5 as System,
    index_d$4 as Terminals,
    index_d$3 as TradeCopier,
    index_d$2 as TransferOrder,
    index_d$1 as User,
    index_d as Workbench,
  };
}
