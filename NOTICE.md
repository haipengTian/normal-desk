# 来源与修改

本项目是独立的通用桌面底座，不是 LINUX DO 官方客户端。

- 前端基础复制自本地 credit-ui；上游 Credit：https://github.com/linux-do/credit，Apache-2.0。复用了 app/globals.css、app/fonts.css、public/fonts、public/style 和 components/ui 中的基础组件。原始许可见 licenses/CREDIT-APACHE-2.0.txt，字体来源与许可见 licenses/FONTS.md。
- 本地 credit-ui 同时含有 CDK（MIT）来源。其许可随来源目录保留；本底座未引入 CDK 业务组件。
- 新增 Electron 主进程、隔离 preload、受控 IPC、偏好持久化、静态资源协议、通用桌面壳、测试与 Windows 打包配置；图标为本项目重新绘制。
- 移除原演示业务，不接入原服务，不申请 OAuth，不提供支付或账号登录。
- Electron、React、Next.js 和其他依赖遵循各自包内许可。Windows 发布目录包含 Electron 的 LICENSE 与 LICENSES.chromium.html。
