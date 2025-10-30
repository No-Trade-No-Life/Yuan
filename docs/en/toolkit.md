# Toolkit

[@yuants/tool-kit](./packages/yuants-tool-kit.md) is everything you need. When you need to build extensions, this provides the CLI. It helps you build docker images, create bundles, and more. To ensure your extensions are ready to use.

## Core Features

### CLI Tools

Provides command-line interface tools, supporting:

- Extension project initialization
- Code building and packaging
- Docker image building
- Dependency management
- Testing and validation

### Build System

Complete build toolchain, including:

- TypeScript compilation
- Code packaging and optimization
- Resource processing
- Version management
- Release process

### Docker Support

Containerized deployment support:

- Dockerfile templates
- Multi-stage builds
- Image optimization
- Deployment configuration

## Main Tools

### Project Scaffolding

Quickly create new extension projects:

```bash
npx @yuants/tool-kit create my-extension
```

### Build Tools

Compile and package extensions:

```bash
npx @yuants/tool-kit build
```

### Docker Build

Create Docker images:

```bash
npx @yuants/tool-kit docker:build
```

### Testing Tools

Run test suites:

```bash
npx @yuants/tool-kit test
```

### Publishing Tools

Publish extensions to npm:

```bash
npx @yuants/tool-kit publish
```

## Development Workflow

### 1. Project Initialization

Use the toolkit to create a new extension project structure.

### 2. Development and Debugging

Provides development server and hot reload support.

### 3. Build and Packaging

Compile source code into deployable packages.

### 4. Testing and Validation

Run automated tests to ensure quality.

### 5. Publishing and Deployment

Publish to npm or build Docker images.

## Configuration Options

### Build Configuration

- TypeScript compilation options
- Packaging optimization settings
- Resource processing rules
- Output directory configuration

### Docker Configuration

- Base image selection
- Environment variable configuration
- Port mapping settings
- Health check configuration

### Publishing Configuration

- npm publishing settings
- Version management strategy
- Dependency management configuration
- Pre-publish validation

## Advantages and Features

### Standardization

- Unified development standards
- Standard project structure
- Consistent build processes

### Automation

- Automated building and testing
- One-click deployment and publishing
- Continuous integration support

### Extensibility

- Supports custom configuration
- Plugin system support
- Flexible build processes

### Efficiency

- Fast build speed
- Optimized output results
- Intelligent caching mechanism

## Use Cases

### Extension Development

- Create new Yuan extensions
- Develop custom components
- Integrate third-party services

### Project Maintenance

- Existing project upgrades
- Dependency update management
- Code quality assurance

### Deployment and Operations

- Production environment deployment
- Containerized operation
- Monitoring and logging

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
