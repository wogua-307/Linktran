# 邻传 Linktran

English documentation: [README.en.md](README.en.md)

版本更新记录：[CHANGELOG.md](CHANGELOG.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Commercial use](https://img.shields.io/badge/Commercial%20use-Allowed-brightgreen.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.5-339933.svg)](package.json)
[![Platforms](https://img.shields.io/badge/Platforms-Web%20%7C%20macOS%20%7C%20Windows-lightgrey.svg)](#三端独立运行)

邻传是一个面向办公室、家庭和临时协作场景的局域网消息与文件传输工具。服务启动后，同一 Wi-Fi 或同一局域网内的手机、平板和电脑可以通过浏览器访问，无需注册账号，也不依赖公网服务。

> 当前版本采用“一个局域网服务节点 + 多个访问端”的架构，不是设备之间的 P2P 直连。所有需要互通的设备必须连接到同一个邻传服务地址。

## 功能截图

### Web/桌面端主界面

设备列表会显示平台和访问端类型，消息气泡支持 Markdown 渲染与快捷复制，左侧可切换群聊和单聊。

![邻传主界面](docs/screenshots/desktop-overview.png)

### 手机扫码连接

在 Web 或桌面端点击“手机连接”，手机扫描二维码即可打开同一局域网服务地址。

![邻传手机扫码连接](docs/screenshots/mobile-connect-qr.png)

### 创建群聊

在会话区域点击“+”，填写群聊名称并选择在线设备，即可创建独立的多人群聊。

![创建群聊](docs/screenshots/create-group.png)

### 发起单聊

切换到“单聊”标签，点击在线设备即可创建独立的设备对话。

![发起单聊](docs/screenshots/single-chat.png)

## 功能概览

### Web 与桌面端

- 共享空间、设备单聊和多人群聊
- 每个会话独立保存消息与文件记录
- 在线设备发现和实时消息推送
- 自动识别桌面客户端、电脑 Web、移动端及 macOS、Windows、Linux、iOS、Android
- 文件选择、批量发送和拖拽上传，单文件上限 1 GB
- 自定义设备昵称和头像
- 中文/English 界面切换，首次访问默认跟随浏览器语言
- 跟随系统、浅色和深色三种外观主题
- 群成员头像组合展示
- 会话未读计数、页面标题提醒和系统通知
- Emoji 输入
- 群聊和共享空间支持通过 `@` 提及指定在线设备
- 支持将剪贴板图片或文件粘贴到输入区，预览后统一发送
- Markdown 消息渲染，支持 GFM 表格、任务列表和代码块
- 消息气泡快捷复制，设备资料变化时局部更新，不打断当前消息浏览位置
- 从网页、Word、飞书等来源粘贴富文本时自动转换为 Markdown
- SQLite 持久化，服务重启后保留资料、会话和消息
- 响应式布局，可通过手机和平板浏览器使用
- Web/桌面端展示局域网连接二维码，手机扫码即可加入
- macOS/Windows 桌面客户端支持系统托盘，关闭窗口后服务继续运行
- 桌面客户端每天自动检查一次 GitHub Release，也可在全局设置中手动检查和关闭

#### 设备资料与提醒设置

点击左侧当前设备卡片可上传 PNG、JPG 或 WebP 头像并修改设备昵称，其他在线设备会实时看到更新后的资料。点击左侧底部的齿轮按钮可打开“全局设置”，切换中文/English 界面、选择跟随系统/浅色/深色主题，并独立开启或关闭新消息提醒。软件偏好保存在当前设备，保存后立即生效。

### 浏览器扩展

Chrome/Edge Manifest V3 扩展目前提供基础能力：

- 使用 IndexedDB 保存本机资料、设置和页面记录
- 从扩展弹窗保存当前页面
- 通过右键菜单“保存到邻传”记录页面或链接
- 展示本地已保存记录数量

扩展目前尚未接入 Web/桌面端的局域网会话和文件传输。扩展数据与服务端 SQLite 相互独立。

## 工作方式

```text
局域网主机
  └─ Linktran HTTP/SSE 服务 :9527
       ├─ SQLite: data/linchuan.db
       ├─ 文件: uploads/
       ├─ 主机上的 Web/桌面界面
       └─ 同一局域网中的浏览器设备
            ├─ Windows / macOS / Linux
            ├─ iPhone / iPad
            └─ Android
```

桌面客户端会在本机启动局域网服务。如果 `9527` 端口已经运行另一个 Linktran 服务，客户端会先检查 `/api/health`，确认后复用该服务。其他设备通过 `http://主机局域网IP:9527` 加入。

如果两台电脑分别启动各自的服务，它们会使用各自的 SQLite 数据库，不会自动同步，也不会彼此发现。团队使用时应指定一台持续在线的设备作为局域网主机。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 局域网服务 | Node.js HTTP、Server-Sent Events |
| 数据存储 | Node.js 内置 `node:sqlite`、SQLite WAL |
| Web 界面 | 原生 HTML、CSS、JavaScript |
| Markdown | marked |
| HTML 安全过滤 | DOMPurify |
| 富文本转 Markdown | Turndown、turndown-plugin-gfm |
| 界面图标 | Lucide |
| 手机连接二维码 | node-qrcode |
| 桌面客户端 | Electron、electron-builder |
| 浏览器扩展 | Chrome Extension Manifest V3、IndexedDB |
| 项目组织 | npm workspaces |

所有浏览器端依赖都会复制到本地构建产物，不依赖 CDN，断开公网后仍可在局域网中运行。

## 环境要求

源码开发需要：

- Node.js `22.5.0` 或更高版本，SQLite 使用 Node.js 内置的 `node:sqlite`
- npm
- macOS、Windows 或 Linux
- 所有通信设备处于同一局域网，且路由器未开启客户端隔离

确认版本：

```bash
node --version
npm --version
```

## 安装与启动

```bash
git clone https://github.com/wogua-307/Linktran.git
cd Linktran
npm install
npm run dev:web
```

启动成功后，终端会列出访问地址：

```text
本机访问: http://localhost:9527
其他设备: http://192.168.1.10:9527
数据文件: /path/to/Linktran/data/linchuan.db
```

本机可以打开 `http://localhost:9527`。其他设备连接同一 Wi-Fi 后，可以打开终端显示的局域网地址，也可以点击页面右上角“手机连接”并扫描二维码加入。

## 三端独立运行

### Web

```bash
npm run dev:web
```

Web 服务监听所有网络接口的 `9527` 端口，并直接使用根目录下的 `public/`、`data/` 和 `uploads/`。

### 桌面客户端

```bash
npm run dev:desktop
```

开发模式下桌面客户端复用根目录服务代码。安装后的客户端把 SQLite 和上传文件保存到 Electron 的 `userData` 目录，卸载应用默认不会主动删除这些数据。

### Chrome/Edge 扩展

```bash
npm run dev:extension
```

然后在浏览器中加载：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `apps/extension/dist`。

开发命令会监听扩展源文件变化并重新生成产物。源码更新后，需要在扩展管理页面点击“重新加载”。

## 构建

### Web 静态资源

```bash
npm run build:web
```

输出目录：`dist/web`

### 桌面端未安装包

```bash
npm run build:desktop
```

使用当前操作系统和架构输出解包后的桌面应用。

### macOS

```bash
npm run build:mac
```

同时构建：

- Intel `x64`：DMG、ZIP
- Apple Silicon `arm64`：DMG、ZIP

产物按版本与架构归档到 `dist/desktop/<版本>/mac-x64` 和 `dist/desktop/<版本>/mac-arm64`。正式分发前应配置 Apple Developer ID 签名和公证，否则 Gatekeeper 可能显示安全警告。

### Windows

```bash
npm run build:win
npm run verify:win
```

输出 Windows 64 位：

- NSIS 安装程序 `.exe`
- 免安装 `.zip`

`verify:win` 会检查 `邻传.exe`、`ffmpeg.dll` 和 `resources.pak` 是否完整。正式对外分发前应配置 Windows 代码签名证书，否则 SmartScreen 可能提示“未知发布者”。
Windows 产物归档到 `dist/desktop/<版本>/windows`。`build:desktop` 生成的当前平台解包目录位于 `dist/desktop/<版本>/.build`。

### 浏览器扩展

```bash
npm run build:extension
```

输出目录：`apps/extension/dist`

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动 Web 服务 |
| `npm run dev:web` | 启动 Web 开发环境 |
| `npm run dev:desktop` | 启动 Electron 客户端 |
| `npm run dev:extension` | 监听并构建浏览器扩展 |
| `npm run dev:lan-host` | 单独启动局域网服务 |
| `npm run build:web` | 构建 Web 静态资源 |
| `npm run build:desktop` | 构建当前平台的桌面目录 |
| `npm run build:icons` | 从 Web Logo 生成 macOS、Windows 桌面图标 |
| `npm run build:mac` | 构建 macOS x64/arm64 安装包 |
| `npm run build:win` | 构建 Windows x64 安装包 |
| `npm run verify:win` | 校验 Windows 运行时文件 |
| `npm run build:extension` | 构建浏览器扩展 |
| `npm run check` | 检查核心 JavaScript 语法 |

## 配置

服务支持以下环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `9527` | HTTP 服务端口 |
| `PUBLIC_DIR` | `<项目>/public` | Web 静态资源目录 |
| `DATA_DIR` | `<项目>/data` | SQLite 数据目录 |
| `UPLOADS_DIR` | `<项目>/uploads` | 上传文件目录 |

示例：

```bash
PORT=9528 DATA_DIR=/path/to/data UPLOADS_DIR=/path/to/uploads npm run dev:web
```

## 数据持久化

Web 服务默认使用：

```text
data/
  linchuan.db
  linchuan.db-wal
  linchuan.db-shm
uploads/
  <实际上传文件>
```

SQLite 中保存：

- 设备 ID、昵称、头像、系统平台和访问端类型
- 会话类型、名称和成员关系
- 文本消息及其顺序
- 文件消息的原始名称、大小和下载地址

实际文件保存在 `uploads/`，不存入 SQLite。完整备份必须同时保存 `data/` 和 `uploads/`。

建议在服务停止后进行备份：

```bash
cp -R data /backup/linktran-data
cp -R uploads /backup/linktran-uploads
```

SQLite 已启用 WAL、外键约束和写入事务。在线状态只存在于内存中，服务重启后会通过 SSE 连接重新发现设备。服务启动时每个会话默认载入最近 100 条消息到内存，数据库中的更早记录不会被删除，但当前界面尚未提供历史消息分页加载。

## Markdown 与富文本

消息在 SQLite 中始终保存为原始 Markdown 文本，展示时经过以下流程：

```text
Markdown 原文 -> marked -> DOMPurify -> 消息气泡
```

从网页、Word 或协作工具粘贴富文本时：

```text
剪贴板 HTML -> DOMPurify -> Turndown + GFM -> Markdown 文本
```

普通纯文本粘贴不会被转换。字体、字号、颜色和复杂页面布局不会保留；标题、强调、链接、引用、列表、代码块、表格和任务列表会尽量转换。单条消息最多 2000 个字符，超出部分会在粘贴时截断并提示。

## HTTP API

当前 API 面向项目内部客户端，没有单独的鉴权层。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/api/network` | 获取当前主机可用的局域网访问地址 |
| `GET` | `/api/qrcode?url=<networkUrl>` | 为有效的局域网地址生成连接二维码 |
| `GET` | `/api/events?id=<deviceId>` | 建立 SSE 连接，接收初始化、在线状态和消息事件 |
| `POST` | `/api/profile` | 新增或更新设备资料 |
| `POST` | `/api/chats` | 创建单聊或群聊 |
| `POST` | `/api/messages` | 向指定会话发送文本消息 |
| `POST` | `/api/files` | 上传文件并创建文件消息 |
| `GET` | `/files/<storedName>` | 下载已上传文件 |

主要 SSE 事件：

| 事件 | 说明 |
| --- | --- |
| `bootstrap` | 当前设备可访问的会话、历史消息和资料 |
| `presence` | 在线设备列表 |
| `profile` | 设备资料更新 |
| `chat` | 新会话通知 |
| `event` | 文本消息或文件消息 |
| `ping` | 连接保活事件 |

## 项目结构

```text
Linktran/
├── apps/
│   ├── desktop/              Electron 客户端与打包配置
│   ├── extension/            Chrome/Edge 扩展
│   └── web/                  Web 构建和前端依赖同步脚本
├── packages/
│   └── protocol/             三端共享协议常量
├── services/
│   └── lan-host/             局域网服务 workspace 入口
├── public/                   Web 页面、样式和交互代码
├── server.js                 HTTP、SSE、文件上传服务
├── storage.js                SQLite 表结构和持久化逻辑
├── data/                     Web 服务数据库，已被 Git 忽略
├── uploads/                  Web 服务上传文件，已被 Git 忽略
├── dist/                     构建产物，已被 Git 忽略
└── package.json              workspace 与统一命令
```

## 安全边界

邻传默认信任当前局域网，现阶段没有账号、密码、设备审批或端到端加密：

- 任何能够访问服务地址的设备都可能读取共享空间内容。
- 会话成员限制由客户端提交的设备 ID 判断，不应作为互联网环境中的强鉴权机制。
- HTTP 流量未加密，同一网络中的流量监听者可能看到消息或文件。
- Markdown 输出经过 DOMPurify 过滤，但仍应保持依赖更新。
- 不要把 `9527` 端口直接暴露到公网，也不要在不可信公共 Wi-Fi 中使用。

如果需要跨网络或公网部署，应先增加 HTTPS、身份认证、访问控制、CSRF/速率限制和更严格的文件安全策略。

## 故障排查

### 其他设备打不开局域网地址

1. 确认设备连接同一个 Wi-Fi，且不是访客网络。
2. 检查路由器是否开启 AP/客户端隔离。
3. 允许 Node.js 或邻传通过系统防火墙接收入站连接。
4. 使用终端输出的局域网 IPv4 地址，不要在其他设备上访问 `localhost`。
5. 企业网络可能禁止终端之间互访，需要联系网络管理员。

### `EADDRINUSE: 9527`

说明端口已被占用。先访问：

```bash
curl http://127.0.0.1:9527/api/health
```

如果返回 `{"app":"linktran","status":"ok"...}`，可以直接复用当前服务；否则结束占用端口的程序，或通过 `PORT=9528` 启动另一个实例。

### Windows 提示缺少 `ffmpeg.dll`

优先使用 NSIS 安装包，不要只复制解包目录中的主程序 `.exe`。运行 `npm run verify:win` 检查运行时文件；同时检查杀毒软件是否隔离了 DLL，并确认安装包传输完整。

### 收不到系统通知

在设备资料设置中打开“新消息提醒”，并允许浏览器或桌面客户端发送通知。部分浏览器只允许安全来源使用系统通知，通过局域网 HTTP 地址访问时可能只能显示应用内提醒。

### 数据没有同步

确认所有设备访问的是完全相同的主机 IP 和端口。分别启动的两个 Linktran 服务拥有独立数据库，不会自动合并。

### 在线设备显示“未知系统”

旧数据库会自动增加平台和访问端字段，不需要清库。设备下次刷新或重新打开客户端时会重新上报资料，之后在线设备列表会显示对应的系统和客户端类型。

## 当前限制

- 不支持公网中继和跨局域网自动连接
- 不支持去中心化 P2P 或多主机数据库同步
- 不支持账号体系、设备审批和端到端加密
- 浏览器扩展尚未接入局域网聊天
- 会话历史界面尚未实现分页加载
- 消息编辑、撤回、搜索和已读回执尚未实现
- 桌面安装包正式分发前仍需配置 macOS/Windows 代码签名

## 开发约定

提交改动前至少运行：

```bash
npm run check
npm run build:web
npm run build:extension
```

涉及桌面端时，再按目标平台运行对应构建。不要提交 `data/`、`uploads/`、`dist/`、`node_modules/` 或扩展构建目录。

## 作者

- 作者：窝瓜
- 邮箱：[1587337963@qq.com](mailto:1587337963@qq.com)
- GitHub：[wogua-307](https://github.com/wogua-307)

## 开源许可与商用

邻传自身代码采用 [MIT License](LICENSE) 开源，允许：

- 个人或公司免费使用，包括商业用途
- 修改源码、二次开发和内部部署
- 复制、分发、再许可或销售包含本项目的产品
- 在闭源商业产品中集成

使用或分发时必须保留原始版权声明和 MIT 许可证文本。本项目按“原样”提供，不包含任何明示或暗示的担保。

项目依赖的第三方组件继续遵循各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。“允许商用”不等于包含商标授权、技术支持、代码签名证书或合规担保，使用方仍需自行评估其业务场景和所在地区的法律要求。
