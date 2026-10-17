# ScreenTools

Windows 显示器管理工具的 Electron 空壳项目。

## 技术栈

- pnpm workspace
- Electron
- Vue 3
- TypeScript
- Vite 和 electron-vite
- ESLint 和 Prettier
- Vitest
- Husky、lint-staged 和 Commitlint

## 开发

```bash
pnpm install
pnpm dev
```

## 质量检查

```bash
pnpm check
```

提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如：

```text
feat: add display overview shell
fix: close the window safely
docs: update architecture notes
```

产品与技术说明见 [docs/显示器管理控制软件说明.md](docs/显示器管理控制软件说明.md)。
