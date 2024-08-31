declare module '@yuants/ui-web' {
  import * as react_jsx_runtime from 'react/jsx-runtime';
  import React, { ComponentType } from 'react';
  import * as rxjs from 'rxjs';
  import { ReplaySubject, BehaviorSubject, Subject, Observable } from 'rxjs';
  import * as _yuants_data_model from '@yuants/data-model';
  import { IDataRecord, IProduct } from '@yuants/data-model';
  import { ColumnDef, Table } from '@tanstack/react-table';
  import { JSONSchema7 } from 'json-schema';
  import { ThemeProps, FormProps } from '@rjsf/core';
  import {
    StrictRJSFSchema,
    RJSFSchema,
    FormContextType,
    TemplatesType,
    RegistryWidgetsType,
  } from '@rjsf/utils';
  import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
  import * as _supabase_supabase_js from '@supabase/supabase-js';
  import { User } from '@supabase/supabase-js';
  import { Terminal } from '@yuants/protocol';

  namespace index_d$v {
    export {};
  }

  const AccountSelector: (props: {
    value: string;
    onChange: (v: string) => void;
    candidates: string[];
  }) => react_jsx_runtime.JSX.Element;

  const InlineAccountId: React.MemoExoticComponent<
    (props: { account_id: string }) => react_jsx_runtime.JSX.Element
  >;

  const useAccountInfo: (account_id: string) => rxjs.Observable<_yuants_data_model.IAccountInfo>;

  const index_d$u_AccountSelector: typeof AccountSelector;
  const index_d$u_InlineAccountId: typeof InlineAccountId;
  const index_d$u_useAccountInfo: typeof useAccountInfo;
  namespace index_d$u {
    export {
      index_d$u_AccountSelector as AccountSelector,
      index_d$u_InlineAccountId as InlineAccountId,
      index_d$u_useAccountInfo as useAccountInfo,
    };
  }

  namespace index_d$t {
    export {};
  }

  namespace index_d$s {
    export {};
  }

  namespace index_d$r {
    export {};
  }

  const registerCommand: (id: string, handler: (params: any) => void) => void;
  const executeCommand: (id: string, params?: {}) => Promise<void>;
  const CommandCenter: React.MemoExoticComponent<() => react_jsx_runtime.JSX.Element>;

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

  namespace index_d$o {
    export {};
  }

  const useValue: <T>(id: string, initialValue: T) => [T, (v: T) => void];

  const index_d$n_useValue: typeof useValue;
  namespace index_d$n {
    export { index_d$n_useValue as useValue };
  }

  interface IDataRecordViewDef<T> {
    TYPE: string;
    columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<IDataRecord<T>, any>[];
    extraRecordActions?: React.ComponentType<{
      reloadData: () => Promise<void>;
      record: IDataRecord<T>;
    }>;
    extraHeaderActions?: React.ComponentType<{}>;
    newRecord: () => Partial<T>;
    mapOriginToDataRecord?: (x: T) => IDataRecord<T>;
    beforeUpdateTrigger?: (x: T) => void | Promise<void>;
    schema?: JSONSchema7;
  }
  /**
   * General Data Record View
   */
  function DataRecordView<T>(props: IDataRecordViewDef<T>): react_jsx_runtime.JSX.Element;

  const index_d$m_DataRecordView: typeof DataRecordView;
  namespace index_d$m {
    export { index_d$m_DataRecordView as DataRecordView };
  }

  namespace index_d$l {
    export {};
  }

  const DesktopLayout: () => react_jsx_runtime.JSX.Element | null;

  const index_d$k_DesktopLayout: typeof DesktopLayout;
  namespace index_d$k {
    export { index_d$k_DesktopLayout as DesktopLayout };
  }

  namespace index_d$j {
    export {};
  }

  const loadTgzBlob: (tgzBlob: Blob) => Promise<
    {
      filename: string;
      blob: Blob;
    }[]
  >;
  function resolveVersion(
    packageName: string,
    ver?: string,
  ): Promise<{
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
  const workspaceRoot$: BehaviorSubject<FileSystemDirectoryHandle | null | undefined>;
  const fs: IFileSystemBackend & {
    ensureDir: (path: string) => Promise<void>;
  };

  const createPersistBehaviorSubject: <T>(key: string, initialValue: T) => BehaviorSubject<T | undefined>;

  const index_d$h_FsBackend$: typeof FsBackend$;
  const index_d$h_createPersistBehaviorSubject: typeof createPersistBehaviorSubject;
  const index_d$h_fs: typeof fs;
  const index_d$h_workspaceRoot$: typeof workspaceRoot$;
  namespace index_d$h {
    export {
      index_d$h_FsBackend$ as FsBackend$,
      index_d$h_createPersistBehaviorSubject as createPersistBehaviorSubject,
      index_d$h_fs as fs,
      index_d$h_workspaceRoot$ as workspaceRoot$,
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
  ) => React.ReactElement<FormProps<any, RJSFSchema, any>, string | React.JSXElementConstructor<any>>;

  /**
   * Request user to input data according to the schema.
   * @param schema - JSON Schema (https://json-schema.org/)
   * @param initialData - Initial data to be filled in the form
   * @returns Promise of user input data
   */
  const showForm: <T>(schema: JSONSchema7, initialData?: any) => Promise<T>;

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

  namespace index_d$e {
    export {};
  }

  /**
   * Yuan Button Component
   *
   * - Button must display loading status after clicking
   * - Button displays loading if and only if click event processing
   * - We need to know whether the backend click event is processing or not.
   */
  const Button: React.MemoExoticComponent<
    (
      props: Omit<ButtonProps, 'onClick' | 'loading'> & {
        onClick: () => Promise<void>;
      },
    ) => react_jsx_runtime.JSX.Element
  >;

  function DataView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  function ListView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  function TableView<T>(props: { table: Table<T> }): react_jsx_runtime.JSX.Element;

  const index_d$d_Button: typeof Button;
  const index_d$d_DataView: typeof DataView;
  const index_d$d_ListView: typeof ListView;
  const index_d$d_TableView: typeof TableView;
  namespace index_d$d {
    export {
      index_d$d_Button as Button,
      index_d$d_DataView as DataView,
      index_d$d_ListView as ListView,
      index_d$d_TableView as TableView,
    };
  }

  namespace index_d$c {
    export {};
  }

  namespace index_d$b {
    export {};
  }

  namespace index_d$a {
    export {};
  }

  const LocalizePageTitle: React.ComponentType<{
    type: string;
    params?: any;
  }>;

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
  const Page: React.MemoExoticComponent<(props: { page: IPage }) => react_jsx_runtime.JSX.Element>;
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

  const AvailableComponents: Record<string, React.ComponentType>;
  const pageRegistered$: Subject<string>;
  const registerPage: (type: string, component: React.ComponentType) => void;

  const index_d$9_AvailableComponents: typeof AvailableComponents;
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

  const useProducts: (datasource_id: string) => Observable<IProduct[]>;

  const index_d$8_useProducts: typeof useProducts;
  namespace index_d$8 {
    export { index_d$8_useProducts as useProducts };
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

  const terminal$: Observable<Terminal | null>;

  const useTick: (datasource_id: string, product_id: string) => rxjs.Observable<_yuants_data_model.ITick>;

  const index_d$5_terminal$: typeof terminal$;
  const index_d$5_useTick: typeof useTick;
  namespace index_d$5 {
    export { index_d$5_terminal$ as terminal$, index_d$5_useTick as useTick };
  }

  namespace index_d$4 {
    export {};
  }

  namespace index_d$3 {
    export {};
  }

  const ensureAuthenticated: () => Promise<void>;

  const index_d$2_ensureAuthenticated: typeof ensureAuthenticated;
  namespace index_d$2 {
    export { index_d$2_ensureAuthenticated as ensureAuthenticated };
  }

  const isShowHome$: rxjs.BehaviorSubject<boolean | undefined>;
  const toggleShowHome: () => void;
  const HomePage: React.MemoExoticComponent<() => react_jsx_runtime.JSX.Element | null>;

  const isDarkMode$: BehaviorSubject<boolean>;
  const useIsDarkMode: () => boolean;

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

  const index_d$1_HomePage: typeof HomePage;
  const index_d$1_isDarkMode$: typeof isDarkMode$;
  const index_d$1_isShowHome$: typeof isShowHome$;
  const index_d$1_toggleShowHome: typeof toggleShowHome;
  const index_d$1_useIsDarkMode: typeof useIsDarkMode;
  const index_d$1_usePageClosingConfirm: typeof usePageClosingConfirm;
  namespace index_d$1 {
    export {
      index_d$1_HomePage as HomePage,
      index_d$1_isDarkMode$ as isDarkMode$,
      index_d$1_isShowHome$ as isShowHome$,
      index_d$1_toggleShowHome as toggleShowHome,
      index_d$1_useIsDarkMode as useIsDarkMode,
      index_d$1_usePageClosingConfirm as usePageClosingConfirm,
    };
  }

  /**
   * Bundle code from entry
   * @param entry entry filename
   * @returns IIFE-formatted code
   */
  const bundleCode: (entry: string) => Promise<string>;

  const index_d_bundleCode: typeof bundleCode;
  namespace index_d {
    export { index_d_bundleCode as bundleCode };
  }

  export {
    index_d$v as AccountComposition,
    index_d$u as AccountInfo,
    index_d$t as AccountRiskInfo,
    index_d$s as Agent,
    index_d$r as Chart,
    index_d$q as CommandCenter,
    index_d$p as Copilot,
    index_d$o as CopyDataRelation,
    index_d$n as Data,
    index_d$m as DataRecord,
    index_d$l as Deploy,
    index_d$k as DesktopLayout,
    index_d$j as Editor,
    index_d$i as Extensions,
    index_d$h as FileSystem,
    index_d$g as Form,
    index_d$f as Fund,
    index_d$e as GeneralSpecificRelations,
    index_d$d as Interactive,
    index_d$c as Kernel,
    index_d$b as Market,
    index_d$a as Order,
    index_d$9 as Pages,
    index_d$8 as Products,
    index_d$7 as PullSourceRelations,
    index_d$6 as SupaBase,
    index_d$5 as Terminals,
    index_d$4 as TradeCopier,
    index_d$3 as TransferOrder,
    index_d$2 as User,
    index_d$1 as Workbench,
    index_d as Workspace,
  };
}