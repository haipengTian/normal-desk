# Desktop Starter

基于 Credit UI 的独立 Electron 桌面底座。包含概览、交互组件、设置、关于；没有聊天、账户、支付等业务。

## 启动开发客户端

Windows 10/11 x64；Node.js 22.12+（推荐 Node 22 LTS）、pnpm 10.21。

```powershell
git clone https://github.com/haipengTian/normal-desk.git
cd normal-desk
corepack pnpm install --frozen-lockfile
corepack pnpm run setup
corepack pnpm dev
```

`pnpm run setup` 下载当前锁定版本的 Electron 并生成主题数据，首次安装需要网络（使用 `run` 避免与 pnpm 自身的 setup 命令混淆）。开发界面只监听 `127.0.0.1:3014`；已有 credit-ui 的 3012 端口不变。界面支持热更新；修改 `desktop/` 或 `shared/` 后重启 `pnpm dev`。

## 运行不依赖网页服务的客户端

```powershell
corepack pnpm build
corepack pnpm start
```

生产界面从 `app://desktop/` 加载内置静态资源，不启动 HTTP 服务，不需要另装 Node.js。顶部采用一体式标题栏：原生最小化、最大化和关闭按钮与界面共用配色，空白处可拖动窗口；窗口位置、大小与最大化状态会在正常退出时保存。

## 安装并使用（推荐入口）

先退出当前运行的旧客户端，再打开 **`release/current/Desktop-Starter-Setup.exe`**。安装完成后，从桌面或开始菜单的 **Desktop Starter** 快捷方式启动；后续版本继续运行同一位置的安装包覆盖升级，应用标识及原有设置目录不变。

`release/` 根目录及 `release/updated/` 是历史构建，不再作为启动入口。历史文件保留，避免影响正在运行的旧版。

```powershell
corepack pnpm dist:win
```

- 固定输出：`release/current/Desktop-Starter-Setup.exe`，当前用户安装，可选择安装目录，创建桌面和开始菜单快捷方式。
- 点击“浏览”选择父目录后，路径自动带上 `Desktop Starter`，例如 `D:\Program Files\Desktop Starter`；选择已有同名目录时不重复追加。升级仍沿用已安装位置。
- `release/current/win-unpacked/Desktop Starter.exe` 用于开发验收，必须连同整个目录使用。
- 仅需要免安装分发时运行 `pnpm dist:portable`，输出 `release/current/Desktop-Starter-Portable.exe`。日常使用仍推荐安装版，避免多个旧 EXE 混用。

打包直接使用 `pnpm run setup` 已安装的锁定版 Electron，不重复从网络下载。当前版本 0.3.0，未配置代码签名，Windows 可能显示未知发布者/SmartScreen 提示；对外发布前需配置签名。macOS/Linux 打包尚未配置。

## GitHub 更新与发布

更新源固定为公开仓库 [haipengTian/normal-desk](https://github.com/haipengTian/normal-desk)。在 **关于 → 应用更新** 手动检查，发现新版后手动下载；下载完成后，选择“重启并安装”并确认。不会后台自动下载、退出时偷偷安装或强制重启。失败可重试；安装器未能启动时保留客户端。

源码运行和便携版不启用自动更新。安装版首次使用此能力，需要手动安装本次 0.3.0；更早的客户端没有更新入口。更新沿用 appId、安装位置和用户设置目录。

本地 `pnpm dist:win` 始终使用 `--publish never`，生成安装包、`.blockmap` 和 `latest.yml`，不进行远程发布。**推送与 package.json 一致的 `v*` 标签即触发正式发布**：Windows workflow 先执行测试、类型检查与构建，以 `--publish never` 生成本次全部产物，再用 GitHub CLI 将三份文件一起上传到草稿，核对齐全后公开 Release。失败会保留草稿，不把不完整更新提供给客户端。GitHub Actions 使用仓库内置 `GITHUB_TOKEN`，不向客户端嵌入令牌。

发布步骤（由仓库维护者执行）：

1. 更新 package.json 版本，并添加对应的 `docs/releases/v版本号.md` 发布说明；推送源码。
2. 确认发布意图后，推送如 `v0.3.0` 的标签，等待 Windows release workflow 成功。
3. 查看公开 Release 的 `Desktop-Starter-Setup.exe`、对应 `.blockmap`、`latest.yml`；不要单独替换安装包而不更新元数据。

若标签发布失败，在 Actions → Windows release → Run workflow 中选择 `main` 并填写已有标签（如 `v0.3.0`）。恢复使用当前工作流和发布脚本，但构建已有标签的源码，不移动标签；只覆盖草稿资产，已公开版本不会覆盖。不要直接重跑仍含旧发布逻辑的历史任务。

后续用更高版本测试完整跨版本升级：检查 → 下载 → 确认安装 → 新版重新启动，确认原安装路径、快捷方式、设置仍有效。

下载由 electron-updater 验证 `latest.yml` 中的 SHA-512，若配置签名身份，还会使用库的签名校验。当前未签名产物不提供 Authenticode 发布者身份保证；面向正式用户分发前需接入签名证书，并完成真实安装升级验收。

## 日志、诊断与故障恢复

- **关于 → 诊断与恢复** 可导出 JSON 诊断或打开日志目录；Windows 也可按 Alt，在“帮助”菜单导出，页面失效时仍可使用。
- 日志在 `userData/logs/main.log`，约 1 MiB 轮转并保留一份 `main.old.log`。记录启动、退出、设置失败、IPC 通道失败和界面异常类别；不采集输入内容、目录内容、完整设置或环境变量。
- 导出仅包含应用/运行时版本、平台、架构、打包状态和最近最多 256 KiB（UTF-8）的脱敏日志。写入前过滤已知凭据格式、URL 详情及本地路径，导出时再次过滤。某份日志无法读取时，报告会标明 `LOG_UNAVAILABLE`，其余环境信息仍可导出。诊断仅在本地保存，不自动上传。
- 渲染进程崩溃、主页面加载失败或启动超过 20 秒未就绪时，主进程弹出恢复窗口，可重新加载、导出诊断或退出；无响应时还可继续等待。不会自动重启循环。
- React 页面异常显示简洁恢复页，可重新加载或导出诊断；恢复页就绪后停止白屏计时。
- 主进程致命异常或启动读取设置失败时，提供重新启动、导出和退出选项，不继续执行异常状态；重启由用户明确选择。
- 重新加载保留已保存设置，但会丢失未保存的页面内容。日志导出失败会提示重新选择可写位置；取消保存不会生成文件或显示成功。

## 基础交互

- 打开窗口时显示居中 Logo 的轻量呼吸动效，界面字体与本地设置就绪后立即进入应用，不设最低展示时间。动效遵循系统及应用的“减少动态效果”设置；初始化失败会显示重试入口。
- 设置支持明暗/跟随系统、Credit 原版 40 种配色、减少动态效果和紧凑侧栏；更改自动保存。
- 主界面只保留导航和页面操作；运行状态、版本与平台信息集中在关于页，不占用侧栏或底部空间。
- `Ctrl / ⌘ + K` 打开快捷操作：搜索页面、切换外观/侧栏、打开数据目录或导出诊断；方向键选择、Enter 执行、Escape 关闭。`Ctrl / ⌘ + ,` 打开设置，`Ctrl / ⌘ + B` 收起/展开侧栏；Windows 按 Alt 显示原生应用菜单。
- 设置页可导出/导入 JSON 外观备份（最大 64 KiB）。备份仅含明暗模式、配色、减少动态效果和侧栏，不包含凭据、目录、窗口位置、托盘或系统启动选项。格式、版本或字段无效时整体拒绝，不部分应用；取消不改设置。
- “恢复默认”需确认，恢复外观与交互、关闭托盘；保留窗口位置与系统登录启动选项。
- “关闭窗口后留在托盘”默认关闭：默认关窗即退出。开启后关闭仅隐藏窗口；托盘单击/双击、显示窗口或再次启动可唤回，托盘“退出”仍结束进程。
- “登录系统时启动”默认关闭，仅 Windows 安装版可用；由系统独立保存，应用只在明确切换时注册，不在每次启动时重写。系统禁用该启动项时界面反映实际状态。
- 交互组件页可操作按钮、输入、通知、弹窗，以及系统目录选择。目录接口只返回路径，不读取或修改目录内容。
- 关于页可查看真实运行版本、打开应用数据目录、通过系统浏览器打开固定文档链接。

设置文件位于 Electron 的 `userData/settings.json`，实际路径见关于页。设置异常时先保留 `settings.invalid-时间戳.json` 备份，再使用默认设置并提示。写入失败会提示，不把未保存的设置显示为已保存。

## 从哪里增加功能

```text
app/                      Next.js 静态入口、Credit 字体和全局样式
components/desktop-shell.tsx  通用页面壳、导航与演示交互
components/ui/            复用的 Credit 基础组件
shared/contracts.ts       renderer / preload / main 的类型契约
shared/preferences.ts     通用偏好及参数校验
desktop/main.ts           原生窗口、菜单、受控 IPC、资源协议
desktop/preload.ts        window.desktop 的明确方法
desktop/settings.ts       串行、临时文件替换式设置保存
desktop/security.ts       静态路径、调用来源与文档链接策略
desktop/logging.ts        有界日志与诊断导出
desktop/diagnostics.ts    脱敏、报告白名单、renderer 类别校验
desktop/recovery.ts       用户驱动、去重的恢复流程
desktop/updates.ts        显式更新状态、进度与重试
desktop/native-updater.ts 等待安装器成功启动后退出
shared/preferences-backup.ts  外观备份白名单与格式校验
components/command-palette.tsx  键盘快捷操作
components/update-panel.tsx  更新状态与显式安装入口
components/app-boundary.tsx  页面异常恢复
scripts/                  开发、主题生成、Electron 验证与打包辅助
```

新增本地能力时，先在 `shared/contracts.ts` 定义明确方法，再接入 main/preload；不要把 `ipcRenderer`、任意文件路径读写或任意命令执行直接暴露给页面。渲染进程保持 `sandbox`、`contextIsolation` 开启与 `nodeIntegration` 关闭。

生产 CSP 仅允许内置脚本（Next 内联引导脚本通过内容哈希授权）、本地字体和图片，默认禁止远程连接、嵌入页面、权限请求和下载。新增联网业务时，应针对实际目标调整权限，不移除整个策略。这里的进程隔离不等于对未来命令执行提供操作系统级沙箱。

主题数据由 `scripts/themes.mjs` 从复制的 CSS 生成，避免沿用原版依赖 Next Server Action 的运行时主题读取。新增主题后运行 `pnpm run setup` 或 `pnpm build:ui`。

## 验证

```powershell
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm test:stability
corepack pnpm test:maturity
corepack pnpm test:updater
corepack pnpm test:dev
```

`test:e2e` 启动真实 Electron 窗口并使用临时用户数据目录，不改变正常客户端设置。截图和结果写入 `artifacts/`。目录选择测试在操作系统对话框边界注入选择/取消结果，实际经过 preload 和 main IPC。

`test:dev` 在 Windows 验证两轮开发启动/关闭及 3014 释放；若端口已有服务则直接退出，不操作该服务。前端依赖在 `devDependencies`，发布时已编译为 `out/` 静态资源；主进程的 `electron-log` 是随包分发的生产依赖，使用不注册 IPC 的 Node 入口。

验证解包产物：

```powershell
$env:DESKTOP_TEST_EXECUTABLE = (Resolve-Path '.\release\current\win-unpacked\Desktop Starter.exe').Path
corepack pnpm test:e2e
corepack pnpm test:stability
corepack pnpm test:maturity
Remove-Item Env:DESKTOP_TEST_EXECUTABLE
```

`test:stability` 验证导出/取消/写入失败、实际 renderer 崩溃后的手动恢复、无响应等待、加载失败、React 恢复页与主进程致命退出。系统对话框选择在 OS 边界注入，真实安装/卸载仍需人工验收。

`test:maturity` 通过真实 Electron 验证备份管理、快捷操作、实际托盘关窗与唤回；对打包产物额外在系统启动/更新库边界注入，验证开关、进度、安装取消及异步失败重试，不改变本机登录启动项或运行安装器。`test:updater` 使用真实 electron-updater 与 Electron 网络，连接临时 loopback feed，验证版本发现、损坏文件校验拒绝与下载重试；测试数据不可执行，不代替 GitHub 跨版本真实安装。

完成情况见 `VERIFICATION.md`，来源见 `NOTICE.md` 与 `licenses/`。
