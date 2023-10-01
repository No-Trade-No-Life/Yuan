# Web UI

This is the source of https://y.ntnl.io and https://y.ntnl.tech

## Getting started 🚀

After `rush update` and build dependencies by `rush build`, you can setup a local development server by running:

```bash
rushx dev # must execute under the working path: 'ui/web'
```

### Modules

This package is organized into modules, each of which is high cohesion and contains some of React components, RxJS Observables & Subjects, utils and others.

#### Core Data Management

These modules provide core data models management. They are the foundation of the whole system.

- [AccountInfo](src/modules/AccountInfo) This deals with AccountInfo.
- [Order](src/modules/Order) This provides some features of order management (view & submit).
- [Products](src/modules/Products) This provides some features of viewing products.

Generally, basic data model will be associated with many derived relations.

- [General Specific Relations](src/modules/GeneralSpecificRelations) This provides the corresponding relations between general and specific products.
- [Pull Source Relation](src/modules/PullSourceRelations) This provides which OHLC data need to pull.
- [Subscription Relation](src/modules/SubscriptionRelation/) This provides which channel need to subscribe.
- [TradeCopier](src/modules/TradeCopier) This provides config management for Trade Copier

#### User Stories & Business Scenes

These modules build scenes for user cases. They are directly create value for users. They are explicit features for users.

- [Agent](src/modules/Agent) This contains business logic of the AgentScene.
- [Deploy](src/modules/Deploy) This provides some features about deploying.
- [Extensions](src/modules/Extensions) This provides some features about extensions.
- [Fund](src/modules/Fund) This provides some features of Fund management. You can sum up multiple accounts and calc investors's equity. You will need it when you're accounting for a fund.
- [Kernel](src/modules/Kernel) This provides some scenes built with `@yuants/kernel`.
- [Market](src/modules/Market) This provides some features of viewing market data.
- [Workspace](src/modules/Workspace) This provides some features of Workspace. Workspace is the user's private files.

#### Great works from community

Thanks to the community, we have some UI enhancement modules. These modules encapsulated some UI components to provide excellent user experience.

- [Chart](src/modules/Chart) This provides many time series chart, powered by [TradingView/lighweight-charts](https://github.com/tradingview/lightweight-charts)
- [Editor](src/modules/Editor) This provides web file editor, powered by [Monaco](https://github.com/microsoft/monaco-editor).
- [Form](src/modules/Form) This connects [React JSON Schema Form](https://github.com/rjsf-team/react-jsonschema-form) to Semi UI.
- [Locale](src/modules/Locale) This provides i18n support. Powered by [react-i18next](https://github.com/i18next/react-i18next)

#### We contribute to the community

These modules are general purpose. They are not related to any specific business. So we can develop them independently and feed back to the community.

- [FileSystem](src/modules/FileSystem) This provides a promise-style filesystem API. Use FileSystemHandle and IndexedDB internally.
- [CommandCenter](src/modules/CommandCenter) This provides a command center module. Other modules and extensions can register commands or execute commands.

#### Connects to the Yuan Cloud Service

We have some enterprise features that users need to connect to the Yuan Cloud Service.

- [User](src/modules/User) This provides some features of user (Login / Logout, Identity Provider).
- [AI](src/modules/AI) This contains LUI, which is a React component that renders a chatbot UI.

#### Misc

I don't know where to put these modules. I have plans to move them to other modules.

- [StaticFileServerStorage](src/modules/StaticFileServerStorage) This provides product and OHLC data in No Host mode.
- [Terminals](src/modules/Terminals) This provides some features of viewing terminals and their status.
- [Workbench](src/modules/Workbench) This provides some features of Workbench. Workbench is the general UI framework.

#### Deprecated

No need to view these modules. They are deprecated.

- [Analyze](src/modules/Analyze) Deprecated.
- [Shell](src/modules/Shell/) Deprecated.
- [StopLoss](src/modules/StopLoss) Deprecated.

### Internationalize & Localize

We strongly recommend you to install VSCode extension: [**i18n Ally**](https://github.com/lokalise/i18n-ally) developed by **Lokalise**. Read its documentation to learn how to use it. You will found an amazing experience.

The only config to the i18n Ally is Display Language (`i18n-ally.displayLanguage`). You can set it to `zh`, `en` or others according to your preference. Please note you should set it in the User configuration, not the Workspace configuration.

All the translation files are in the [`public/locales`](public/locales) directory.

We prefer to use namespace to organize i18n keys. The name of namespace is corresponding to the name of React component. We assume every exported React component has an unique name and has its own namespace. And the file name is same with the component's name. Tiny components inner a module and never be exported can have a simpler and replicable name.

We don't like to repeat namespace as the prefix of key. For example, we don't like to use `SomeComponent_xxx` and `SomeComponent_yyy` as the key. We prefer to use `xxx`, `yyy` with namespace `SomeComponent` as the key.

```ts
// Bad
const { t } = useTranslation();

t('SomeComponent_xxx');
t('SomeComponent_yyy');

// Good
const { t } = useTranslation('SomeComponent');

t('xxx');
t('yyy');
```

#### Special namespace

Note that some special namespaces are reserved for special usage.

- i18n key formed with `"commands:<id>"` will be used for translating the command's display name.
- i18n key formed with `"pages:<id>"` will be used for translating the title of the page.

### Layouts & Pages

There are several pages from different modules.

**Page** is a top-level React component with some serializable params.
Module ["Pages"](src/modules/Pages) provides the layout-independent model and methods to manipulate pages.

**Layout** is a top-top-level React component that indicates how to render the pages.

Layout should respond to the device screen size and adjust the layout accordingly, while the page should respond to the page's inner viewport.

There are two kinds of layout: DesktopLayout and MobileLayout. They are used to render different UI according to the screen size.

With large screen, module ["DesktopLayout"](src/modules/DesktopLayout) will be used. You can manage multiple pages in one screen. DesktopLayout use [flexlayout-react](https://github.com/caplin/FlexLayout) to render the layout. You can drag and drop the panels to change the layout.

With small screen, MobileLayout will be used. In mobile layout, you can view only one page at a time. You can swipe left to go-back or right to go-forward by the history.

Some Tips for responsive design:

- use `<Table />` in large screen and use `<List />` in small screen.
- use `<Modal />` and other pop-ups in large screen and use a single page in small screen.
