# 在线视频下载管理器

一个功能完整、界面现代的「在线视频下载管理器」Web 应用。粘贴公开视频链接，系统自动识别平台、解析视频信息并创建下载任务，支持多任务并发、实时进度、暂停/继续/取消、任务持久化与重启恢复。

> 仅用于下载**公开且你有权访问/已获授权**的视频资源。本项目不破解 DRM、不绕过付费墙、登录限制或其他平台安全机制；对受限资源会给出清晰的错误提示。

## ✨ 主要功能

- **多平台解析**：YouTube / Bilibili / Vimeo / X (Twitter) / TikTok / Instagram，以及通用直链
- **视频预览卡片**：标题、缩略图、平台、时长、作者、可用分辨率与格式、预估大小
- **任务队列**：多任务并发（默认 3，可调 1/2/3/5/10）、状态机（Waiting / Parsing / Downloading / Paused / Completed / Failed / Cancelled）
- **实时进度**：百分比、进度条、速度、剩余时间（WebSocket 推送）
- **任务控制**：暂停 / 继续 / 取消 / 重试 / 删除，失败原因明确（中文提示）
- **下载历史**：搜索、按平台/状态筛选、按时间/大小排序、删除记录（与删除文件严格区分）
- **Dashboard**：今日任务、完成数、下载中、失败数、累计下载量、累计任务、成功率、每日下载量、各平台分布、最近任务
- **设置页**：默认质量/格式、并发数、保存目录、限速、超时、重试、外观（Light/Dark/System）、系统状态（版本/数据库/目录/磁盘）
- **任务恢复**：服务重启后自动读取数据库，恢复 Waiting / Downloading / Paused 任务，Completed 不重复下载
- **响应式**：桌面完整布局，平板/手机自适应，无横向滚动
- **Docker 一键部署**

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · React Router · Recharts · lucide-react |
| 后端 | Node.js · TypeScript · Fastify · @fastify/websocket |
| 数据 | SQLite（Node 内置 `node:sqlite`） |
| 下载引擎 | yt-dlp（视频解析/下载）+ ffmpeg（音视频合并） |

## 📁 项目目录结构

```
.
├── server/                 # 后端
│   ├── src/
│   │   ├── index.ts        # 入口：Fastify、路由注册、静态托管、优雅退出
│   │   ├── config.ts       # 环境变量与配置
│   │   ├── db.ts           # SQLite 封装（任务/设置）
│   │   ├── types.ts        # 共享类型
│   │   ├── errors.ts       # 错误分类（中文提示）
│   │   ├── platform/       # 平台识别与 URL 校验
│   │   ├── services/
│   │   │   ├── ytdlp.ts    # yt-dlp/ffmpeg 探测与调用
│   │   │   ├── parser.ts   # 元数据解析
│   │   │   ├── downloader.ts # 下载进程管理（进度/暂停/取消）
│   │   │   ├── queue.ts    # 并发受限任务队列
│   │   │   ├── taskService.ts
│   │   │   ├── settings.ts / stats.ts / system.ts / broadcast.ts
│   │   └── routes/         # REST 路由
├── client/                 # 前端
│   └── src/
│       ├── components/     # UI 组件、布局、任务卡片等
│       ├── pages/          # Home / Tasks / History / Dashboard / Settings
│       ├── hooks/          # useTheme / useToast / useTasks(WS)
│       ├── lib/            # 工具函数
│       └── api.ts          # API 客户端
├── bin/                    # 本地 yt-dlp 二进制（开发用，可选）
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 🚀 安装与启动

### 前置要求

- Node.js ≥ 22（推荐 24）
- 可选但推荐：ffmpeg（合并音视频流、转 MP3 需要；未安装时自动降级为渐进式单文件下载）
- 可选：yt-dlp（未安装时，请把 `yt-dlp.exe` / `yt-dlp` 放到项目 `bin/` 目录，或通过 `YTDLP_PATH` 指定）

### 开发环境

```bash
# 安装依赖（npm workspaces 一次装齐前后端）
npm install

# 同时启动后端(8787)与前端(5173)，前端已配置代理
npm run dev
```

打开 <http://localhost:5173>。后端 API 位于 <http://localhost:8787/api>。

> 首次运行后可在 `bin/` 放置 `yt-dlp.exe`（Windows）或 `yt-dlp`（Linux/macOS），程序会自动探测。

### 生产环境

```bash
npm install
npm run build        # 构建后端(server/dist) + 前端(client/dist)
npm start            # 由后端在同一端口托管前端
```

打开 <http://localhost:8787>。

## ⚙️ 环境变量

复制 `.env.example` 为 `.env`（开发）或在环境中注入：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 后端端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATA_DIR` | `<root>/data` | SQLite 数据目录 |
| `DOWNLOAD_DIR` | `<root>/downloads` | 默认下载保存目录 |
| `YTDLP_PATH` | 空 | yt-dlp 二进制路径（空则自动探测） |
| `FFMPEG_PATH` | 空 | ffmpeg 路径（空则自动探测） |
| `MAX_CONCURRENCY` | `3` | 默认并发数 |
| `MAX_SPEED` | `0` | 默认限速（字节/秒，0=不限） |
| `TIMEOUT_SEC` | `60` | 网络超时（秒） |
| `RETRIES` | `3` | 自动重试次数 |

## 🐳 Docker 部署

```bash
docker compose up -d
```

打开 <http://localhost:8787>。数据与下载分别持久化到命名卷 `vdm-data`、`vdm-downloads`。

**国内网络 / 镜像源**：镜像内会执行 `apt-get`（ffmpeg）与 `pip`（yt-dlp）。国内环境可用构建参数切换镜像源，加速构建：

```bash
docker compose build \
  --build-arg APT_MIRROR=mirrors.tuna.tsinghua.edu.cn \
  --build-arg PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
docker compose up -d
```

**QNAP NAS（Container Station）**：如需让下载文件直接出现在 File Station 的「Public」共享文件夹中，可用绑定挂载覆盖默认的命名卷。数据目录与下载目录请按实际共享文件夹调整：

```yaml
# docker-compose.nas.yml
services:
  app:
    volumes:
      - /share/CACHEDEV1_DATA/vdm/data:/app/data
      - /share/CACHEDEV1_DATA/Public/VideoDownloadManager:/downloads
```

然后执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.nas.yml up -d --build
```

## 🔌 API 文档

统一前缀 `/api`，错误响应格式：`{ "error": { "code": "…", "message": "…" } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/tasks/parse` | 解析视频元数据（`{ url }`） |
| GET | `/api/tasks` | 任务列表 |
| POST | `/api/tasks` | 创建任务（`{ url, quality?, format? }`） |
| GET | `/api/tasks/:id` | 任务详情 |
| POST | `/api/tasks/:id/pause` | 暂停 |
| POST | `/api/tasks/:id/resume` | 继续 |
| POST | `/api/tasks/:id/cancel` | 取消 |
| POST | `/api/tasks/:id/retry` | 重试 |
| DELETE | `/api/tasks/:id?deleteFile=true` | 删除任务（可选删除文件） |
| POST | `/api/tasks/:id/open` | 打开所在文件夹 |
| GET | `/api/history?search=&platform=&status=&sort=` | 下载历史 |
| GET | `/api/dashboard` | 统计概览 |
| GET | `/api/settings` | 读取设置 |
| PUT | `/api/settings` | 更新设置 |
| GET | `/api/system` | 系统状态 |
| WS | `/ws` | 实时任务推送（`task` / `task-deleted` / `settings`） |

## ❓ 常见问题

- **解析失败 / 视频资源不可访问**：视频可能为私有、会员、地区受限或需登录，本项目不会绕过这些限制，请改用你有权访问的公开资源。
- **需要 ffmpeg 的提示**：合并 `bestvideo+bestaudio` 或转 MP3 需要 ffmpeg。安装 ffmpeg，或选择 MP4/渐进式格式。
- **端口冲突**：修改 `PORT` 环境变量。
- **重启后任务不丢失**：任务状态持久化在 SQLite，重启后自动恢复。

## ⚠️ 免责声明

本工具仅供个人学习与下载自有/已授权内容使用。请遵守各平台服务条款与当地法律，尊重版权。
