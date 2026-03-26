# ChatBiobank - 3M Framework AI Assistant

ChatBiobank 是基于 Kimi K2.5 大模型 + RAG 的 AI 助手，专门服务于多组学生物样本库（3M Framework: Multi-omics, Multimodal biospecimen, Multi-departmental coordination）的知识问答。

**在线访问**: [https://www.chatbiobank.com](https://www.chatbiobank.com)

## 功能特点

- 基于 3M Framework 完整知识库的 RAG 问答
- Kimi K2.5 大模型驱动，支持 SSE 实时流式响应
- 7 个 HTML 知识页面自动解析为结构化 Markdown，注入 system prompt
- 回答自动附带知识库来源链接
- 会话历史管理（本地部署支持服务端存储，Vercel 部署为无状态）
- 响应式设计，支持移动端
- 3M Framework 各章节可独立浏览

## 技术栈

- **前端**: HTML5, CSS3, Vanilla JavaScript, marked.js
- **后端**: Node.js, Express
- **AI**: Kimi K2.5 (Moonshot AI) OpenAI-compatible API
- **RAG**: cheerio 解析 HTML 知识库，全文注入 system prompt
- **部署**: Vercel Serverless Functions

## 项目结构

```
ChatBiobank/
├── public/                  # 前端静态文件
│   ├── index.html          # SPA 主页面
│   ├── app.js              # 前端逻辑（SSE 解析、会话管理）
│   ├── styles.css          # Claude 风格 UI
│   ├── icon.svg            # Logo
│   └── 3m/                 # 3M Framework 知识库页面
│       ├── index.html      # 知识库导航页
│       ├── introduction.html
│       ├── omics.html
│       ├── sample_management.html
│       ├── ethics.html
│       ├── workflow.html
│       ├── discussion.html
│       └── authors.html
├── server.js               # 本地 Express 服务器（含 RAG + 会话存储）
├── config.js               # 环境变量配置
├── lib/
│   ├── rag.js              # RAG 引擎（HTML → Markdown → system prompt）
│   └── conversations.js    # 内存会话存储
├── api/                    # Vercel Serverless Functions
│   ├── chat.js             # 聊天 API（内嵌 RAG）
│   ├── conversations.js    # 会话列表
│   ├── messages.js         # 消息历史
│   ├── files/upload.js     # 文件上传
│   └── chat-messages/[taskId]/stop.js  # 停止响应
├── index.js                # Vercel SPA 路由入口
├── vercel.json             # Vercel 部署配置
└── package.json
```

## 本地开发

```bash
git clone https://github.com/youngfly93/ChatBiobank.git
cd ChatBiobank
npm install
```

创建 `.env` 文件：

```env
MOONSHOT_API_KEY=your-moonshot-api-key
MOONSHOT_API_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=kimi-k2.5
```

启动：

```bash
npm start            # 访问 http://localhost:3000
```

## Vercel 部署

本项目已部署在 Vercel 上，代码 push 到 GitHub 后自动部署。

### 环境变量

在 Vercel 控制台 → Project Settings → Environment Variables 中设置：

| 变量名 | 说明 | 必填 |
|---|---|---|
| `MOONSHOT_API_KEY` | Moonshot AI API 密钥 | 是 |
| `MOONSHOT_API_BASE_URL` | API 地址（默认 `https://api.moonshot.cn/v1`） | 否 |
| `MOONSHOT_MODEL` | 模型名称（默认 `kimi-k2.5`） | 否 |

### 自定义域名配置

由于 `*.vercel.app` 在国内被 DNS 污染无法直接访问，本项目通过自定义域名解决：

**域名**: `chatbiobank.com`（京东云注册）

**DNS 解析配置**（京东云控制台 → 域名管理 → DNS 解析）：

| 主机记录 | 记录类型 | 记录值 |
|---|---|---|
| `@` | CNAME | `cname.vercel-dns.com` |
| `www` | CNAME | `cname.vercel-dns.com` |

**Vercel 域名绑定**（Vercel 控制台 → Settings → Domains）：

添加 `chatbiobank.com` 和 `www.chatbiobank.com`，Vercel 自动配置 SSL 证书。

**解析流程**：

```
用户浏览器访问 www.chatbiobank.com
  → 京东云 DNS 解析 CNAME → cname.vercel-dns.com
  → Vercel DNS 解析 → Vercel 真实服务器 IP (76.76.21.x)
  → Vercel 返回网站内容
  → SSL 证书由 Vercel 自动签发（Let's Encrypt）
```

> **注意**: 不需要 ICP 备案，因为 Vercel 服务器在境外。`chatbiobank.com` 访问时会 307 重定向到 `www.chatbiobank.com`。

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/chat` | POST | 流式聊天（SSE），调用 Kimi K2.5 |
| `/api/conversations` | GET | 获取会话列表 |
| `/api/conversations/:id` | DELETE | 删除会话 |
| `/api/messages` | GET | 获取消息历史 |
| `/api/files/upload` | POST | 上传文件 |
| `/api/chat-messages/:taskId/stop` | POST | 停止正在生成的回复 |

## License

MIT
