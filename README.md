# pressure-twin-server

## 项目简介

这是一个基于 `Fastify`、`Prisma`、`SQLite` 的服务端项目，当前包含：

- 基础服务启动与数据库初始化流程
- 巡检相关数据模型与种子数据
- 基于 Markdown 知识库的切片构建
- 基于 DashScope `text-embedding-v4` 的知识库向量化脚本

## 环境准备

推荐使用：

- Node.js 22+
- `pnpm`

项目依赖通过 `pnpm install` 安装，安装完成后会自动执行 `prisma generate`。

## 环境变量

请在项目根目录准备 `.env` 文件，至少包含以下配置：

```env
DATABASE_URL="file:./dev.db"

DASHSCOPE_API_KEY="你的 DashScope API Key"
# 可选，默认是北京地域兼容接口
# DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
# 可选，默认 30000
# DASHSCOPE_TIMEOUT_MS="30000"

DEEPSEEK_API_KEY="你的 DeepSeek API Key"
# 可选，默认 https://api.deepseek.com
# DEEPSEEK_BASE_URL="https://api.deepseek.com"
# 可选，默认 deepseek-v4-flash
# DEEPSEEK_DEFAULT_MODEL="deepseek-v4-flash"
# 可选，默认 120000
# DEEPSEEK_TIMEOUT_MS="120000"

PORT="3003"
```

说明：

- `DASHSCOPE_API_KEY` 用于知识库向量化脚本。
- `DASHSCOPE_BASE_URL` 默认使用北京地域兼容接口；如果你的工作空间在新加坡，需要改成对应地域的兼容地址。
- `DEEPSEEK_API_KEY` 用于项目中的模型能力，例如巡检报告解析。

## 快速启动

首次在新环境启动时，按以下顺序执行：

```bash
pnpm install
pnpm prisma:migrate
pnpm db:seed
pnpm dev
```

说明：

- `pnpm install`：安装依赖，并自动执行 `prisma generate`
- `pnpm prisma:migrate`：执行 Prisma 迁移，创建或更新本地数据库表
- `pnpm db:seed`：执行 [prisma/seed.ts](./prisma/seed.ts)，写入初始数据
- `pnpm dev`：以开发模式启动服务

只有在以下场景下，才通常需要手动执行 `pnpm prisma:generate`：

- 修改了 `prisma/schema.prisma`
- 升级了 `prisma` 或 `@prisma/client`

## 常用命令

```bash
pnpm dev
pnpm build
pnpm start
pnpm prisma:migrate
pnpm prisma:generate
pnpm db:seed
pnpm run kb:build
pnpm run kb:embed
```

命令说明：

- `pnpm build`：执行 TypeScript 编译
- `pnpm start`：运行编译后的产物
- `pnpm run kb:build`：重新扫描 `knowledge/` 下的 Markdown，生成 `chunks.json`，并继续生成 `embeddings.json`
- `pnpm run kb:embed`：只基于已有 `knowledge/build/chunks.json` 重建 `embeddings.json`，不会重新切片

## 知识库构建流程

### 1. 生成切片

知识库源文件放在 `knowledge/` 目录下。执行：

```bash
pnpm run kb:build
```

脚本会：

- 递归读取 `knowledge/` 下的 Markdown 文件
- 跳过 `knowledge/build/` 目录
- 解析标题、章节和正文
- 按预设长度切分为多个 chunk
- 输出到 `knowledge/build/chunks.json`

每个 chunk 会包含完整检索上下文，其中 `contentWithContext` 的格式大致如下：

```text
文档标题：...
章节：...
正文：...
```

这个字段会作为后续 embedding 的实际输入文本。

### 2. 生成向量

在已经存在 `knowledge/build/chunks.json` 的前提下，执行：

```bash
pnpm run kb:embed
```

脚本会：

- 读取 `chunks.json`
- 只提取每个 chunk 的这三个字段参与向量化：
  - `id`
  - `documentId`
  - `contentWithContext`
- 按批次调用 DashScope `text-embedding-v4`
- 生成 `1024` 维向量
- 输出到 `knowledge/build/embeddings.json`

如果希望“一次完成切片和向量化”，直接执行：

```bash
pnpm run kb:build
```

## 知识库产物说明

### `knowledge/build/chunks.json`

用于保存完整 chunk 信息，包括正文、上下文和元数据。它是知识库的主数据文件。

典型用途：

- 展示命中文档正文
- 回查来源信息
- 后续重新生成 embeddings

### `knowledge/build/embeddings.json`

用于保存向量索引信息。当前采用“分离存储”方案，只保留最小字段：

```ts
type EmbeddedChunk = {
  id: string
  documentId: string
  embedding: number[]
  embeddingModel: string
  embeddingDimensions: number
}
```

说明：

- `id`：向量与 chunk 的关联键
- `documentId`：便于按文档删除、更新和排查
- `embedding`：对应 chunk 的向量
- `embeddingModel` / `embeddingDimensions`：记录向量生成参数，便于后续校验和迁移

当前不会在 `embeddings.json` 中重复存储以下内容：

- `sourcePath`
- `fileName`
- `title`
- `headings`
- `sectionTitle`
- `content`
- `contentWithContext`
- `metadata`

命中某个向量后，可以通过 `id` 回查 `chunks.json` 获取完整正文与来源信息。

## 向量化策略说明

当前知识库采用的是：

- `chunks.json`：保存正文和元数据
- `embeddings.json`：保存 `id` 与向量

这样做的好处是：

- 文件职责清晰
- 重建 embeddings 时不会重复保存大量正文
- 后续替换 embedding 模型时，数据结构更容易迁移

如果后面接入 Qdrant、Milvus 或其他向量库，可以再考虑把常用字段一起放入 payload，而不是继续依赖本地 `chunks.json` 回查。

## 注意事项

- 本项目当前使用 `SQLite`。
- Prisma 迁移文件位于 [prisma/migrations](./prisma/migrations/)。
- 如果在新环境中 `better-sqlite3` 安装失败，请重新安装依赖，确保其原生构建脚本正常执行。
- 如果 embedding 请求超时或连接失败，优先检查：
  - 本机是否能访问 DashScope
  - 是否开启了会影响 Node 请求的代理或 VPN
  - `DASHSCOPE_BASE_URL` 是否与实际地域一致
