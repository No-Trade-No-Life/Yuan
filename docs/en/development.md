# Developer Guide

This guide is for developers of the Yuan project, helping you set up the development environment and build the project.

## Prerequisites

- `nodejs >= 22.14.0`
- [docker](https://www.docker.com/) for image building
- [rush](https://rushjs.io/) for monorepo management

## Installing Rush

```bash
npm install -g @microsoft/rush
```

## Installing Dependencies and Building the Project

```bash
rush update && rush build
```

## Development Workflow

1. **Code Modification**: Make code changes in the corresponding packages
2. **Build Testing**: Run `rush build` to ensure code compiles successfully
3. **Run Tests**: Run `rush test` to execute unit tests
4. **Commit Code**: Follow the project's code submission standards

## Project Structure

The Yuan project uses a monorepo structure, including:

- **apps/** - Application packages
- **libraries/** - Shared library packages
- **tools/** - Development tools
- **ui/** - User interface related packages

## Development Recommendations

- Follow the project's coding standards and code style
- Use TypeScript for type-safe development
- Write unit tests to ensure code quality
- Use Prettier for automatic code formatting

---

<p align="center">
  <a href="README.md">Back to Documentation Home</a>
</p>
