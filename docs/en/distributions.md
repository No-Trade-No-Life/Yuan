# Distributions

Yuan is a powerful operating system, but it's also too low-level, primitive, and difficult to use. Only geek-type users can master it, making it unsuitable for direct use by ordinary users.

For different user scenarios, it's best to provide specific distributions that are pre-configured with some features so users can use them directly.

Below are some distributions we provide as references. You can create your own distributions based on your needs.

## Official Distributions

### [@yuants/dist-origin](distributions/origin): Native Distribution

[Click to experience online](https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin)

The native distribution provides the complete functionality of the Yuan system, suitable for developers and advanced users.

## Creating Distributions

The essence of a distribution is a workspace, and the essence of a workspace is a file directory and its contents. We can package a workspace into a distribution, which users can then download and extract to use. We recommend using the npm package management tool to manage distributions, meaning distributions are published to the npm registry, and users can install distributions via npm.

### Distribution Features

- **Pre-configured**: Pre-configured with commonly used functions and services
- **Ease of Use**: Lowers the barrier to entry, suitable for specific user groups
- **Professionalization**: Optimized configuration for specific scenarios
- **Customizable**: Secondary development based on existing distributions

### Creation Steps

1. **Create Workspace**: Create a workspace directory containing the required configurations and files
2. **Configure Features**: Configure corresponding functions and services based on target user needs
3. **Package and Publish**: Package the workspace and publish it to the npm registry
4. **Documentation Writing**: Provide detailed usage instructions and configuration guides

## Installing Distributions

In the Web GUI URL parameters, we can specify to install distributions from npm using the `from_npm` parameter. For example, `https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin`.

### URL Parameters

- `from_npm`: Whether to install the distribution from npm. `1` for yes, leave empty for no.
- `scope`: npm package scope, optional parameter.
- `name`: npm package name, required parameter.
- `version`: npm package version, version number range that conforms to [semver](https://semver.org/) specification, optional parameter. Defaults to the latest version.

### Installation Examples

```
// Install the latest version of @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin

// Install a specific version (0.0.2) of @yuants/dist-origin distribution
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=0.0.2

// Install @yuants/dist-origin distribution with specific version (>=0.0.2)
https://y.ntnl.io?from_npm=1&scope=yuants&name=dist-origin&version=>=0.0.2
```

## Distribution Types

### Basic Distribution

- Provides core functionality
- Suitable for developers and advanced users
- Highly customizable

### Professional Distribution

- Optimized for specific trading strategies
- Pre-configured with professional tools
- Suitable for professional traders

### Beginner Distribution

- Simplified configuration and operation
- Provides wizard-style setup
- Suitable for beginners

### Enterprise Distribution

- Includes enterprise-level features
- Supports team collaboration
- Provides professional support

## Advantages and Features

- **Quick Start**: Pre-configured environment, quickly put into use
- **Professional Optimization**: Deep optimization for specific scenarios
- **Community Contribution**: Encourages community creation and sharing of distributions
- **Continuous Updates**: Officially maintained, regularly updated

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
