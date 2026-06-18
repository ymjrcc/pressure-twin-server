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
pnpm run knowledge:qa:test
```

命令说明：

- `pnpm build`：执行 TypeScript 编译
- `pnpm start`：运行编译后的产物
- `pnpm run kb:build`：重新扫描 `knowledge/` 下的 Markdown，生成 `chunks.json`，并继续生成 `embeddings.json`
- `pnpm run kb:embed`：只基于已有 `knowledge/build/chunks.json` 重建 `embeddings.json`，不会重新切片
- `pnpm run knowledge:qa:test`：本地串联执行一次“检索 + 回答”知识库问答测试

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

## 知识库问答接口

当前知识库问答接口统一挂载在 `/api/ai` 前缀下，推荐按“两步调用”使用：

1. 先调用 `/api/ai/knowledge-match` 做向量检索
2. 再把检索结果传给 `/api/ai/knowledge-answer` 生成最终回答

这样前端既可以展示命中的依据，也方便后续追加重排、人工确认或多轮问答能力。

### 1. 检索知识片段

接口：

```http
POST /api/ai/knowledge-match
Content-Type: application/json
```

请求体：

```json
{
  "question": "安全阀失效但工艺压力一直正常，能否继续运行？",
  "topK": 5
}
```

参数说明：

- `question`：必填，用户问题，不能为空字符串
- `topK`：可选，返回前 `K` 个最相似片段，默认 `5`，取值范围 `1 ~ 20`

成功响应示例：

```json
{
  "ok": true,
  "data": {
    "question": "安全阀失效但工艺压力一直正常，能否继续运行？",
    "topK": 5,
    "matches": [
      {
        "score": 0.912345,
        "chunk": {
          "id": "chunk_xxx",
          "documentId": "special-equipment-kb-starter/02_压力容器巡检/安全阀检查与异常处理.md",
          "sourcePath": "special-equipment-kb-starter/02_压力容器巡检/安全阀检查与异常处理.md",
          "fileName": "安全阀检查与异常处理.md",
          "title": "安全阀检查与异常处理",
          "headings": ["安全阀检查与异常处理", "常见异常"],
          "sectionTitle": "常见异常",
          "content": "……",
          "contentWithContext": "文档标题：……",
          "charCount": 320,
          "sectionChunkIndex": 0,
          "sectionChunkCount": 1,
          "documentChunkIndex": 3,
          "documentChunkCount": 8,
          "metadata": {}
        }
      }
    ]
  }
}
```

说明：

- `score` 为余弦相似度，值越大表示越相关
- `matches[].chunk` 是完整知识片段，可直接用于前端展示
- 检索依赖本地 `knowledge/build/chunks.json` 与 `knowledge/build/embeddings.json`

### 2. 基于检索结果生成回答

接口：

```http
POST /api/ai/knowledge-answer
Content-Type: application/json
```

请求体可以直接传 `knowledge-match` 的 `data`，也可以传完整响应对象；服务端会自动兼容这两种格式。

推荐请求体：

```json
{
  "question": "安全阀失效但工艺压力一直正常，能否继续运行？",
  "topK": 5,
  "matches": [
    {
      "score": 0.912345,
      "chunk": {
        "id": "chunk_xxx",
        "title": "安全阀检查与异常处理",
        "sourcePath": "special-equipment-kb-starter/02_压力容器巡检/安全阀检查与异常处理.md",
        "sectionTitle": "常见异常",
        "content": "……"
      }
    }
  ]
}
```

成功响应示例：

```json
{
  "ok": true,
  "data": {
    "question": "安全阀失效但工艺压力一直正常，能否继续运行？",
    "answer": "根据现有资料，不应仅因工艺压力暂时正常就判断可以继续运行，应尽快按规定处理并由相关专业人员确认是否具备继续使用条件[资料1][资料2]。",
    "usedRefs": ["资料1", "资料2"],
    "citations": [
      {
        "ref": "资料1",
        "chunkId": "chunk_xxx",
        "title": "安全阀检查与异常处理",
        "sourcePath": "special-equipment-kb-starter/02_压力容器巡检/安全阀检查与异常处理.md",
        "sectionTitle": "常见异常",
        "score": 0.912345
      }
    ],
    "isGroundedEnough": true,
    "insufficientReason": null
  }
}
```

字段说明：

- `answer`：最终回答，关键判断句尾会带 `[资料1]` 这类引用标记
- `usedRefs`：回答里实际使用到的资料编号
- `citations`：每个资料编号对应的来源片段，便于前端展示“引用来源”
- `isGroundedEnough`：知识库依据是否足够支撑当前回答
- `insufficientReason`：当依据不足时给出原因，否则为 `null`

### 联调示例

先检索：

```bash
curl -X POST http://localhost:3003/api/ai/knowledge-match \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "压力表封签损坏应该如何处理？",
    "topK": 5
  }'
```

再将上一步返回的 `data` 作为请求体传给回答接口：

```bash
curl -X POST http://localhost:3003/api/ai/knowledge-answer \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "压力表封签损坏应该如何处理？",
    "topK": 5,
    "matches": []
  }'
```

实际联调时，请把 `matches` 替换成 `/knowledge-match` 返回的真实内容。

### 错误响应

当请求参数不合法或上游模型调用失败时，接口会返回统一结构：

```json
{
  "ok": false,
  "error": {
    "message": "question must be a non-empty string"
  }
}
```

常见情况：

- `400`：请求体缺失、字段类型错误、`question` 为空、`topK` 超范围、`matches` 为空
- `502`：DashScope 或 DeepSeek 调用失败、返回空结果、返回的 JSON 不合法

### 使用前检查

在调用知识库接口前，请先确认：

- 已执行 `pnpm run kb:build`，且 `knowledge/build/chunks.json` 与 `knowledge/build/embeddings.json` 已生成
- `.env` 中已配置 `DASHSCOPE_API_KEY`，用于 `/knowledge-match`
- `.env` 中已配置 `DEEPSEEK_API_KEY`，用于 `/knowledge-answer`
- 服务已通过 `pnpm dev` 或 `pnpm start` 启动，默认端口为 `3003`

## 知识库问答测试脚本

项目内提供了本地测试脚本 [src/scripts/testKnowledgeQa.ts](./src/scripts/testKnowledgeQa.ts)，用于直接在命令行串联执行一次：

1. 知识片段检索
2. 基于检索结果生成回答

这个脚本不会请求本地 HTTP 接口，而是直接调用服务层里的 `matchKnowledge` 和 `answerKnowledgeQuestion`，适合在开发阶段快速验证知识库链路是否可用。

### 基本用法

使用默认问题运行：

```bash
pnpm run knowledge:qa:test
```

传入自定义问题：

```bash
pnpm run knowledge:qa:test "压力表封签损坏应该如何处理？"
```

同时传入问题和 `topK`：

```bash
pnpm run knowledge:qa:test "安全阀失效但工艺压力一直正常，能否继续运行？" 8
```

参数说明：

- 第一个参数：问题文本
- 第二个参数：`topK`，必须是整数；未传时默认 `5`
- 如果未传问题，脚本默认使用：`压力表异常应该怎么处理？`

### 输出内容

脚本会依次输出：

- 本次测试的问题和 `topK`
- `knowledge-match` 阶段耗时
- 命中片段摘要，包括 `ref`、`score`、`chunkId`、`title`、`sectionTitle`、`sourcePath` 和 `contentPreview`
- `knowledge-answer` 阶段耗时
- 最终回答 JSON

输出示意：

```text
=== Knowledge QA Test ===
Question: 压力表异常应该怎么处理？
Top K: 5

Step 1: running /knowledge-match logic...
Step 1 completed in 320ms
Matched chunks summary:
[
  {
    "ref": "资料1",
    "score": 0.912345,
    "chunkId": "chunk_xxx",
    "title": "压力表液位计测温仪表检查",
    "sectionTitle": "常见异常",
    "sourcePath": "special-equipment-kb-starter/02_压力容器巡检/压力表液位计测温仪表检查.md",
    "contentPreview": "……"
  }
]

Step 2: running /knowledge-answer logic...
Step 2 completed in 1840ms
Answer result:
{
  "question": "压力表异常应该怎么处理？",
  "answer": "……",
  "usedRefs": ["资料1"],
  "citations": [],
  "isGroundedEnough": true,
  "insufficientReason": null
}
```

### 使用前检查

运行脚本前，请先确认：

- `.env` 已配置 `DASHSCOPE_API_KEY` 和 `DEEPSEEK_API_KEY`
- 已执行 `pnpm run kb:build`，本地知识库切片和向量文件存在
- 当前网络可以访问 DashScope 和 DeepSeek

如果第二个参数不是整数，脚本会直接报错：`topK argument must be an integer`

## 注意事项

- 本项目当前使用 `SQLite`。
- Prisma 迁移文件位于 [prisma/migrations](./prisma/migrations/)。
- 如果在新环境中 `better-sqlite3` 安装失败，请重新安装依赖，确保其原生构建脚本正常执行。
- 如果 embedding 请求超时或连接失败，优先检查：
  - 本机是否能访问 DashScope
  - 是否开启了会影响 Node 请求的代理或 VPN
  - `DASHSCOPE_BASE_URL` 是否与实际地域一致
