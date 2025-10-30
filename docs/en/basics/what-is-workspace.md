# Workspace

**Workspace** is a **file directory** that centrally stores user data. It is similar to the concept of a disk in traditional operating systems.

**Workspace** contains files such as user policies, indicators, keys, data, plugins, etc., so its privacy cannot be overemphasized.

**Strong Privacy Security**: None of the contents in the workspace will be automatically uploaded to the cloud unless the user explicitly performs an upload operation.

Users can create, load, and manage workspaces in the start menu of the navigation bar in Yuan GUI.

## Customizing Workspaces

The contents of a workspace are loaded when Yuan GUI starts, so users can store their preferences, plugins, applications, etc., in the workspace.

For example, users can switch between different systems by switching workspaces, similar to installing dual systems on a computer. For instance, distinguishing between personal and team workspaces.

Users can customize their workspaces just like customizing personal operating systems, including but not limited to:

- Customizing themes, desktops, wallpapers
- Customizing plugins, applications
- Installing third-party distributions, plugins, applications

:::warning

Installing third-party distributions, plugins, applications may bring security risks, and users need to bear the risks themselves.

This requires a security antivirus software similar to that in operating systems to solve the problem, but it is currently missing.

Therefore, try to install only trusted third-party distributions, plugins, applications.

:::

## Distributions

Yuan is a powerful operating system, but it is also too low-level, primitive, and difficult to use, making it suitable only for geek users and not directly for ordinary users.

For different user scenarios, it is best to provide specific distributions that are pre-configured with some features for users to use directly.

Below are some distributions we provide as references. You can create your own distributions based on your needs.

- [@yuants/dist-origin](./packages/yuants-dist-origin.md): Native distribution [Click to experience online](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

The essence of a distribution is a workspace, and the essence of a workspace is a file directory and its contents. We can package a workspace into a distribution, and then users can download and unzip it to use. We recommend using the npm package management tool to manage distributions, i.e., distributions will be published to the npm repository, and users can install distributions via npm.

In the Web GUI address parameters, we can specify installing distributions from npm via the `from_npm` parameter. For example, `https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin`.

URL Parameters:

- `from_npm`: Whether to install the distribution from npm. `1` for yes, blank for no.
- `scope`: The scope of the npm package, optional parameter.
- `name`: The name of the npm package, required parameter.
- `version`: The version of the npm package, in the format of a [semver](https://semver.org/) version range, optional parameter. Defaults to the latest version.

```
// Install the latest version of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin

// Install a specific version (0.0.2) of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=0.0.2

// Install a specific version (>=0.0.2) of the @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=>=0.0.2
```

:::warning[Disclaimer]

The security and stability of the distribution depend on the author of the distribution, and users need to bear the risks themselves.

The risks arising from the misuse of distributions are borne by the publisher of the distribution, the distribution channel, and the user themselves. No Trade No Life does not assume any responsibility.

:::

## Workspace Backend

Different workspace backends vary in terms of access speed, persistence, shareability, and compatibility.

Users can choose the appropriate backend based on their needs.

Currently, Yuan supports the following backends:

- FileSystem

  A workspace stored on the local computer, bound to a folder in the local file system.

  The user needs to select a folder as the workspace and authorize Yuan GUI to access it, and all subsequent operations will be performed within this workspace.

  Theoretically, it provides the same experience as the local file system!

  Opening a local folder, as of September 2024, is still an experimental feature of the browser, supporting only desktop versions of Chrome 86 / Edge 86 / Opera 72 and above. It is temporarily not supported on mobile devices.

  Compatibility can be tracked continuously through [this page](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker).

- IndexedDB

  A workspace stored in the browser's IndexedDB, which is persisted to the local file system.

  However, when the user's disk space is insufficient, it may be actively cleared by the native operating system of the user's device. **In this case, data may be lost**.

  Supported on both desktop and mobile devices by mainstream browsers.

- In-Memory

  A workspace stored in the browser's memory, which is not persisted to the local file system.

  **Data will be lost after refreshing.** Suitable for temporary startup without the need for persistent data. Also suitable for launching third-party distributions from the network.

  Obviously, it is supported on all devices.

:::note[Other backends planned for construction]

- Amazon S3

  The S3 protocol, also known as the Amazon S3 (Simple Storage Service) protocol, is an object storage service protocol provided by Amazon Web Services (AWS).
  The S3 protocol defines how to interact with the S3 service via HTTP/HTTPS interfaces to store, retrieve, and manage data objects.
  The S3 protocol has become an **industry standard in cloud storage**, and many cloud service providers offer storage services compatible with the S3 protocol, such as Aliyun OSS.

  A workspace stored in the cloud, bound to the user's cloud storage account.

  Supports HTTP API, so it is compatible with all devices. However, the speed may be affected by the network environment, and additional network fees may be incurred.

  The user needs to authorize Yuan GUI to access the cloud storage, and all subsequent operations will be performed within this workspace.

  Suitable for users who need multi-device synchronization.

- Terminal Service

  The device connects to another terminal within the same host via the host, and this terminal proxies a file system, appearing as a file system.

  Typically, this terminal is a container or NodeJS service connected to a file system. This terminal is also under your control, so it is privacy-safe.

  Supports network access, so it is compatible with all devices. However, the speed may be affected by the network environment, and additional network fees may be incurred. Also, other terminals within the host may access this file system, so attention to permission control is needed.

  Suitable for users who need multi-device synchronization.

:::
