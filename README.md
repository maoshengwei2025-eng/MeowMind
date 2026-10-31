# 喵呜导图 MeowMind

> 喵呜导图 —— 让你的想法像猫咪一样灵活跳跃。

一个单文件、零外部依赖的思维导图工具。整个应用打包在一个 HTML 文件（`bundle.html`，约 460 KB）里，浏览器双击打开即可使用，无需安装、无需联网、数据不出本机。

## 在线使用

GitHub Pages 托管地址：<https://maoshengwei2025-eng.github.io/MeowMind/>

## 离线使用

下载本仓库根目录的 `bundle.html`，双击即可在浏览器中离线运行。

## 目录结构

```
MeowMind/
├── index.html      # 在线主页入口（与 bundle.html 相同）
├── bundle.html     # 单文件应用本体
└── meowmind-app/   # 源码工程（React 19 + TypeScript + Vite + Tailwind CSS）
```

## 从源码构建

```bash
cd meowmind-app
pnpm install
pnpm build
```

## 版权

© 2026 Mr-MAO
