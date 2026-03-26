require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');
const rag = require('./lib/rag');
const store = require('./lib/conversations');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 初始化 RAG 引擎
rag.initialize();

// 存储活跃的 curl 进程（用于 stop 功能）
const activeStreams = new Map();

/**
 * 通过 curl 子进程调用 Kimi API（绕过 WSL2 DNS 问题）
 * 返回 curl 子进程，stdout 为 SSE 流
 */
function callKimiStream(messages) {
    const requestBody = JSON.stringify({
        model: config.MOONSHOT_MODEL,
        messages,
        stream: true
    });

    // 使用 stdin 传输请求体（避免命令行参数长度限制）
    const curlProcess = spawn('curl', [
        '-s', '-N',
        `${config.MOONSHOT_API_BASE_URL}/chat/completions`,
        '-H', `Authorization: Bearer ${config.MOONSHOT_API_KEY}`,
        '-H', 'Content-Type: application/json',
        '-d', '@-',
        '--max-time', '120'
    ]);

    curlProcess.stdin.on('error', (err) => {
        console.error('Curl stdin error:', err.message);
    });
    curlProcess.stdin.write(requestBody);
    curlProcess.stdin.end();

    return curlProcess;
}

// 聊天 API 路由 —— 调用 Kimi K2.5，SSE 格式转换为前端期望的 Dify 格式
app.post('/api/chat', async (req, res) => {
    const { query, user, conversation_id, role } = req.body;
    let conversationId = conversation_id;
    const messageId = store.generateId();
    const taskId = store.generateId();

    try {
        // 获取或创建会话
        if (!conversationId) {
            const conv = store.createConversation(user, query);
            conversationId = conv.id;
        }

        // 记录用户消息
        store.addMessage(conversationId, 'user', query);

        // 构建消息数组：system prompt（含全量知识库 + 角色指令） + 历史对话
        const systemPrompt = rag.buildSystemPrompt(role);
        const chatHistory = store.getChatHistory(conversationId);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory
        ];

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 调用 Kimi K2.5 API（通过 curl 子进程）
        const curlProcess = callKimiStream(messages);
        activeStreams.set(taskId, curlProcess);

        let fullResponse = '';
        let buffer = '';

        curlProcess.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const dataStr = trimmed.slice(6);
                if (dataStr === '[DONE]') {
                    const endEvent = {
                        event: 'message_end',
                        message_id: messageId,
                        conversation_id: conversationId
                    };
                    res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
                    continue;
                }

                try {
                    const kimiData = JSON.parse(dataStr);
                    const delta = kimiData.choices?.[0]?.delta;
                    // 只转发 content（最终回答），跳过 reasoning_content（思考过程）
                    if (delta?.content) {
                        fullResponse += delta.content;
                        const difyEvent = {
                            event: 'message',
                            answer: delta.content,
                            message_id: messageId,
                            conversation_id: conversationId,
                            task_id: taskId
                        };
                        res.write(`data: ${JSON.stringify(difyEvent)}\n\n`);
                    }
                } catch (parseErr) {
                    // 跳过无法解析的行
                }
            }
        });

        curlProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.trim()) console.error('Kimi curl stderr:', msg);
        });

        curlProcess.on('error', (err) => {
            console.error('Kimi curl spawn error:', err.message);
        });

        curlProcess.on('close', (code) => {
            activeStreams.delete(taskId);

            // 存储完整的助手回复
            if (fullResponse) {
                store.addMessage(conversationId, 'assistant', fullResponse);
            }

            // 如果还没发送过 message_end（curl 异常退出），补发一个
            if (!res.writableEnded) {
                if (!fullResponse && code !== 0) {
                    // curl 失败且无内容
                    const errorEvent = {
                        event: 'message',
                        answer: '抱歉，AI 服务暂时不可用，请稍后再试。',
                        message_id: messageId,
                        conversation_id: conversationId
                    };
                    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
                }
                res.end();
            }
        });

        // 标记客户端是否主动断开
        let clientDisconnected = false;
        req.on('close', () => {
            clientDisconnected = true;
        });

        // 响应结束时清理 curl
        res.on('close', () => {
            if (clientDisconnected && !curlProcess.killed && curlProcess.exitCode === null) {
                curlProcess.kill('SIGTERM');
            }
            activeStreams.delete(taskId);
        });

    } catch (error) {
        activeStreams.delete(taskId);
        console.error('Chat API error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to process chat request',
                message: error.message
            });
        } else {
            res.end();
        }
    }
});

// 获取会话列表
app.get('/api/conversations', (req, res) => {
    const { user, limit = 20 } = req.query;
    const result = store.listConversations(user, parseInt(limit));
    res.json(result);
});

// 获取会话消息历史
app.get('/api/messages', (req, res) => {
    const { conversation_id, limit = 20 } = req.query;
    const result = store.getMessages(conversation_id, parseInt(limit));
    if (!result) {
        return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(result);
});

// 删除会话
app.delete('/api/conversations/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    store.deleteConversation(conversationId);
    res.status(204).send();
});

// 停止响应
app.post('/api/chat-messages/:taskId/stop', (req, res) => {
    const { taskId } = req.params;
    const curlProcess = activeStreams.get(taskId);
    if (curlProcess && !curlProcess.killed) {
        curlProcess.kill('SIGTERM');
        activeStreams.delete(taskId);
    }
    res.json({ result: 'success' });
});

// 文件上传（简化版 —— Kimi API 不支持独立文件上传）
app.post('/api/files/upload', (req, res) => {
    res.status(501).json({ error: 'File upload not supported in current configuration' });
});

// SPA 路由：非 API、非静态文件的请求返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 导出 app 供 Vercel 使用
module.exports = app;

// 只在非 Vercel 环境下启动服务器
if (process.env.NODE_ENV !== 'production') {
    app.listen(config.PORT, () => {
        console.log(`Server is running on http://localhost:${config.PORT}`);
        console.log(`API Key configured: ${config.MOONSHOT_API_KEY ? 'Yes' : 'No'}`);
        console.log(`Model: ${config.MOONSHOT_MODEL}`);
    });
}
