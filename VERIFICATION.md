# 验收记录

## 第二批 · 0.3.0 · 2026-10-19

Windows 11 x64 / Node.js 22.23.3 / pnpm 10.21.0 / Electron 44.9.0。

- `pnpm test`：39 项通过，含外观备份格式/字段/大小校验、旧配置迁移与重置保留窗口、更新状态/进度/重试、异步安装器启动失败不退出并可重试。新能力先观察测试失败再实现；快捷面板缺失以及紧凑窗口方向键选择项不可见均有真实客户端失败记录。
- `pnpm typecheck`、`pnpm build`、`pnpm dist:win` 通过。0.3.0 安装包、blockmap、latest.yml 与 win-unpacked 已生成；最终快捷面板滚动修复后用已编译源码重新打包，并再次通过打包客户端 maturity/e2e 验证。
- `pnpm test:maturity` 对源码及打包客户端通过：Ctrl+K、搜索/方向键/Enter/Escape、空结果；设置导出/导入/确认重置、取消、无效及超大文件不改原设置；真实 Tray 创建、关窗隐藏、再次启动唤回、关闭托盘。900×620 紧凑窗口中方向键选中的最后一项保持可见。
- 打包客户端第二批烟测额外在 OS 登录启动边界注入读写，确认开关与无效参数拒绝，未改本机真实启动项；在更新库边界注入版本/进度与异步安装失败，经过真实主进程 IPC、确认框和渲染事件，验证下载进度、取消安装不启动、失败保留客户端并可重试、安装前窗口状态落盘。未运行安装器。
- `pnpm test:updater` 通过：真实 electron-updater 6.8.9 与 Electron 网络访问临时 loopback feed；识别新版本、未自动下载、SHA-512 拒绝损坏数据、重试下载成功并报告进度。数据不可执行，不含安装动作。
- 0.3.0 打包客户端现有 `test:e2e` 与 `test:stability` 通过：导航/主题/字体/标题栏颜色、桥接隔离、偏好与窗口状态持久化，以及诊断导出、实际 renderer/React 崩溃恢复、早期错误取消白屏监测、主进程致命退出。最终快捷面板滚动修复未改变这些原生稳定性路径。
- 已查看实际打包客户端快捷面板、设置管理、更新初始/进度/重试页面，以及含原生控制按钮的完整浅色窗口截图。无版本或运行状态侧栏杂讯。
- 独立只读审查完成：修复 electron-updater 的异步启动安装器失败时仍可能退出问题；保留上游下载/校验/签名，显式安装改为等待 Windows 接受进程后再退出，启动失败清除重入标志供重试。再次定点复核通过。
- 发布前实际打包客户端连接 `haipengTian/normal-desk`，日志确认 `No published versions on GitHub`，界面返回可重试检查失败；不是“已是最新版”。仓库元数据查询确认公开，默认分支 main。`resources/app-update.yml` 已指向该仓库，latest.yml 版本为 0.3.0。

### 当前入口与证据

- 安装：`release/current/Desktop-Starter-Setup.exe`，必须先退出旧版再手动安装这次 0.3.0；旧版没有更新能力。
- 解包：`release/current/win-unpacked/Desktop Starter.exe`；随整个目录使用。
- 更新元数据：`release/current/latest.yml`、`Desktop-Starter-Setup.exe.blockmap`。
- `artifacts/packaged-maturity.json`、`packaged-smoke.json`、`packaged-stability.json`、`updater-fixture.json`、`github-check.json`。
- 截图：`command-palette.png`、`maturity-settings.png`、`update-panel.png`、`update-progress.png`、`update-retry.png`、`window-light.png`。

### 首次 GitHub 发布进度 · 2026-10-19

- 已初始化 Git 并推送至 `haipengTian/normal-desk` 的 `main`；发布提交 `2b1ee184bd1f4b1225bd5f514edf19f361fbee2c` 与标签 `v0.3.0` 已推送。
- 发布前本地 45 项测试与类型检查通过，发布脚本独立只读审查通过。
- [首次 Windows release 工作流](https://github.com/haipengTian/normal-desk/actions/runs/39193008807) 已结束，结论为 failure。云端安装依赖、测试、类型检查、构建与 Create draft release 均成功；最后 Publish complete release 失败，尚未公开正式版本。匿名 Release latest 查询仍为 404。
- 维护者提供失败日志：草稿缺少 `Desktop-Starter-Setup.exe.blockmap`，被完整性检查拒绝发布。已将打包与上传分开：先 `--publish never` 生成整套产物，再由 GitHub CLI 一次显式上传三份文件，核对后才公开；保留资产完整性检查。
- 新增手动恢复入口，使用已有标签源码与当前发布工具，不移动标签，不替换已公开资产。回归测试先失败后通过，覆盖缺 blockmap 草稿的完整重传、本地缺文件、远端仍缺文件及查询/上传/发布失败。本次 48 项测试、类型检查和独立只读审查通过。尚待维护者触发修复后的工作流与发布后的真实客户端检查。
- 当前仓库尚无正式版本，无法执行 GitHub 跨版本真实下载/安装/重启验收。维护者发布首版和更高版本后，按 README 完成完整升级，确认路径/快捷方式/设置保留。
- 安装包 Authenticode 状态为 `NotSigned`；SHA-512 检查只验证下载与元数据一致，当前未签名构建没有发布者身份保证。本次授权发布未签名测试构建；正式分发需配置签名。
- 未执行本机安装/卸载或真实登录系统启动；保存/打开/确认框选择、系统启动开关均在边界注入。目录后缀修复仍待真实安装器 UI 验收。macOS/Linux 未验收。

## 第一批历史记录 · 0.2.0

2026-10-18，Windows 11 x64 / Node.js 22.23.3 / pnpm 10.21.0。

### 已完成

- `pnpm test`：28 项通过。覆盖既有偏好、持久化、安全策略，以及本轮脱敏、诊断白名单、UTF-8 字节上限、日志落盘/轮转、日志不可读降级、恢复等待/去重/手动选择。诊断入口、恢复流程和审查发现的启动早期异常/中文日志边界均有先失败后通过的记录。
- `pnpm typecheck`：前端与主进程 TypeScript 检查通过。
- `pnpm build`：Electron TypeScript 编译与 Next.js 16.3.3 静态导出通过。
- `pnpm test:e2e`：真实 Electron 44.9.0 窗口通过；最终同一脚本对 `release/current/win-unpacked/Desktop Starter.exe` 再次通过，`packaged: true`，包含原生标题栏颜色像素校验。
- 真实窗口检查：导航、浅色/深色与配色切换、Claude → Default 后主题变量清理、自托管字体族、减少动态效果、侧栏收起/展开、弹窗及 Escape、通知、目录选择与取消、无 renderer Node.js 访问、无效 IPC 参数拒绝、偏好重启保留、窗口尺寸/最大化重启恢复、紧凑窗口无横向溢出。
- 一体式标题栏：主界面无重复版本、运行状态或页脚；原生窗口控制区可见且与应用按钮不重叠，标题栏空白区为原生拖动区域。检查了包含系统按钮的浅色、深色完整窗口截图。最小化/还原/最大化/关闭通过 Electron 窗口 API 验证，未自动点击系统按钮。
- 去掉顶部横线和侧栏右侧竖线，保留内容内部边界。新增两个实际计算边框宽度为 0 的断言，先失败后通过；已查看无分割线的完整浅色窗口截图。
- Windows 125% 缩放下，改用正常窗口内容尺寸保存与恢复，修复隐藏标题栏导致的窗口逐次增长；最大化后重启还原、再次普通重启均保持 1040 × 740 的内容尺寸。
- 原生按钮直接使用当前主题配色转换后的 sRGB 值，避免重启时读取尚未更新的 body 样式；修复深色窗口重启最大化后按钮区域变白的问题。完整窗口像素校验确认按钮区与标题栏背景一致。
- 轻量启动画面：居中 Logo 呼吸动效，无版本或状态杂讯。等待字体及 info/preferences 初始化，无人为延时；初始化期间主界面隐藏且不可聚焦。测试先因缺少启动画面失败，再实现通过；真实 IPC 挂起/释放验证画面保留与就绪后移除，注入失败验证退出加载及重试成功，检查浅色/深色与系统/保存的减少动态效果，实际完整窗口截图已查看。
- 目录对话框测试在 OS 边界注入选择/取消返回值，经过真实 preload/main IPC；没有自动操作 Windows 的目录对话框内部。
- `pnpm test:dev`：两轮从启动到关闭原生窗口，开发进程退出且 3014 监听释放；Windows 清理只针对本脚本持有 PID 的进程树。
- 已查看实际 Electron 浅色概览、深色设置、组件页、紧凑关于页截图；修正了原模板缺失字体别名导致的回退。
- 独立只读代码审查完成；此前主题变量残留，以及本轮启动早期 React 异常重复弹窗、中文日志字节上限两个问题，均补失败复现并修复。
- `pnpm dist:win`：最终 0.2.0 构建、NSIS 固定安装包与 win-unpacked 生成成功。主进程 electron-log 生产依赖随包分发，使用 Node 入口、不注册库自身的 Electron IPC；实际打包客户端已运行。生产资源通过本地自定义协议提供，不运行 3014 服务。
- `pnpm test:stability` 对最终 `release/current/win-unpacked/Desktop Starter.exe` 通过（`packaged: true`）：真实诊断导出、取消、写入失败；类别报告与多余字段拒绝；实际 renderer 崩溃后手动重新加载；无响应事件后选择继续等待；主页面加载失败后的重新加载；实际 React 渲染异常及恢复。
- 启动未完成就触发 React 异常，恢复页取消白屏计时；实际等待超过 20 秒，确认没有第二次原生恢复提示。先在修复前复现原生提示计数 1，修复后为 0。
- 主进程注入 uncaughtException，确认提供重新启动/导出/退出选项；选择退出后进程结束，未自动重启。检查落盘的致命异常日志不包含测试 token。
- 已查看本轮打包客户端的关于/诊断区与异常恢复页实际截图。安装包入口统一到 release/current/Desktop-Starter-Setup.exe，历史产物不再作为推荐入口。

### 当时产物与证据（current 现已更新为 0.3.0）

- 安装包：`release/current/Desktop-Starter-Setup.exe`（0.2.0）。安装后统一从 Desktop Starter 桌面或开始菜单快捷方式启动。
- 解包验收入口：`release/current/win-unpacked/Desktop Starter.exe`。
- 历史的 `release/` 根目录与 `release/updated/` 不再推荐启动；文件保留，避免影响旧进程。首次切换需先退出旧版。
- `artifacts/packaged-smoke.json`、`artifacts/packaged-stability.json`：最终打包客户端结果。
- `artifacts/diagnostics-about.png`、`artifacts/recovery-fallback.png`：本轮实际界面。
- `artifacts/window-light.png`、`artifacts/window-dark.png`、`artifacts/window-compact.png`、`artifacts/window-maximized.png`：含原生窗口按钮的完整截图。
- `artifacts/window-startup.png`、`artifacts/window-startup-dark.png`：真实 IPC 初始化等待期间的启动画面。
- `artifacts/dev-smoke.json`：此前开发双轮启动/关闭与端口释放记录，本批未修改 dev 脚本。

## 验证范围

### 2026-10-19 安装目录选择修复

- 新增 `build/installer.nsh` 并通过 `nsis.include` 接入；使用 NSIS 编译期 `InstallDir` 为原生 Browse 按钮启用程序目录后缀，不在运行时重设 `$INSTDIR`。
- 安装器配置回归测试先失败后通过。已核对 NSIS 3.0.4 的编译/浏览逻辑：从 InstallDir 末尾组件取后缀，选中同名目录时以不区分大小写的比较避免重复；electron-builder 的注册表路径恢复与 `/D` 处理保持原流程。
- 用既有、已验收的 `release/current/win-unpacked` 重新生成 `release/current/Desktop-Starter-Setup.exe`，NSIS 编译成功；生成脚本确认加载了项目的 installer.nsh。独立代码审查无问题。
- 本机 Computer Use 服务连接失败（native pipe unavailable），按恢复步骤重试后仍不可用，未操作真实目录选择对话框。父目录追加、同名目录去重与旧安装路径沿用仍待实际安装器 UI 验收；未执行安装/卸载。

- 安装包已生成；未在当前系统执行安装/卸载或覆盖升级流程。解包后的真实客户端运行、交互、重启与故障恢复已通过；安装路径和系统快捷方式需用户安装时确认。
- 0.2.0 当时没有代码签名证书，产物为未签名开发版本；当时未配置自动更新。0.3.0 的更新能力见上文。
- macOS、Linux 与其他 Windows 设备未运行验收。
- 原生保存/消息框的选择在 OS 对话框边界注入；渲染进程确实崩溃、React 确实抛出渲染错误、致命异常处理确实退出进程。无响应和加载失败由 Electron 事件注入，未人为阻塞真实 UI 或破坏安装文件。
- 20 秒真实白屏的计时器在早期恢复页用例验证了取消；未另行等待真实白屏超时、点击真实系统恢复对话框或执行重新启动选项。
- 构建有全局 pnpm 配置及间接依赖弃用提示；构建成功，最终客户端运行验证通过。
