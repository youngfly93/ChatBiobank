# AI Chat Website - Claude风格的AI聊天助手

这是一个基于Dify API的AI聊天网站，采用Claude风格的用户界面设计。

## 功能特点

- 🎨 Claude风格的优雅界面设计
- 💬 实时流式对话响应
- 📎 支持图片文件上传
- 🗂️ 会话历史管理
- 🎯 快捷功能按钮（写作、学习、编程、生活）
- 📱 响应式设计，支持移动端

## 技术栈

- **前端**: HTML5, CSS3, Vanilla JavaScript
- **后端**: Node.js, Express
- **API**: Dify AI API
- **依赖**: axios, cors, multer, dotenv

## 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd ai-chat-website
```

2. 安装依赖
```bash
npm install
```

3. 配置API密钥
编辑 `config.js` 文件，替换您的Dify API密钥：
```javascript
DIFY_API_KEY: 'your-api-key-here'
```

4. 启动服务器
```bash
npm start
```

5. 访问应用
打开浏览器访问 `http://localhost:3000`

## 项目结构

```
ai-chat-website/
├── public/              # 前端静态文件
│   ├── index.html      # 主页面
│   ├── styles.css      # 样式文件
│   └── app.js          # 前端JavaScript
├── server.js           # Node.js服务器
├── config.js           # 配置文件
├── package.json        # 项目依赖
└── README.md          # 项目说明
```

## API端点

- `POST /api/chat` - 发送聊天消息
- `POST /api/files/upload` - 上传文件
- `GET /api/conversations` - 获取会话列表
- `GET /api/messages` - 获取消息历史
- `DELETE /api/conversations/:id` - 删除会话

## 使用说明

1. **发送消息**: 在输入框中输入消息，按Enter或点击发送按钮
2. **上传图片**: 点击回形针图标选择图片文件
3. **新建对话**: 点击左侧"新对话"按钮
4. **快捷输入**: 使用底部功能按钮快速填充输入框

## 注意事项

- 确保您的Dify API密钥有效且有足够的配额
- 目前仅支持图片文件上传（png, jpg, jpeg, webp, gif）
- 文件上传大小限制为10MB

## 开发模式

如果您安装了nodemon，可以使用开发模式：
```bash
npm install -g nodemon
npm run dev
```

## License

MIT