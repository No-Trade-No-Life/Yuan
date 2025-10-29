# 开发者指南

本指南面向 Yuan 项目的开发者，帮助您搭建开发环境和构建项目。

## 前提条件

- `nodejs >= 22.14.0`
- [docker](https://www.docker.com/) 用于镜像构建
- [rush](https://rushjs.io/) 用于 mono repo 管理

## 安装 Rush

```bash
npm install -g @microsoft/rush
```

## 安装依赖并构建项目

```bash
rush update && rush build
```

## 开发工作流

1. **代码修改**：在相应的包中进行代码修改
2. **构建测试**：运行 `rush build` 确保代码编译通过
3. **运行测试**：运行 `rush test` 执行单元测试
4. **提交代码**：遵循项目的代码提交规范

## 项目结构

Yuan 项目采用 monorepo 结构，包含：

- **apps/** - 应用程序包
- **libraries/** - 共享库包
- **tools/** - 开发工具
- **ui/** - 用户界面相关包

## 开发建议

- 遵循项目的编码规范和代码风格
- 使用 TypeScript 进行类型安全的开发
- 编写单元测试确保代码质量
- 使用 Prettier 自动格式化代码

---

<p align="center">
  <a href="README.md">返回文档首页</a>
</p>
