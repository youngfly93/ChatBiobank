const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const config = require('./config');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 限制10MB
    },
    fileFilter: (req, file, cb) => {
        // 只允许图片文件
        const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只支持图片文件'));
        }
    }
});

// 聊天API路由
app.post('/api/chat', async (req, res) => {
    try {
        const { query, user, conversation_id, files, response_mode = 'streaming' } = req.body;
        
        // 构建请求数据
        const requestData = {
            query,
            user,
            response_mode,
            inputs: {}
        };
        
        if (conversation_id) {
            requestData.conversation_id = conversation_id;
        }
        
        if (files && files.length > 0) {
            requestData.files = files;
        }
        
        // 调用Dify API
        const response = await axios.post(
            `${config.DIFY_API_BASE_URL}/chat-messages`,
            requestData,
            {
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            }
        );
        
        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 转发流式响应
        response.data.on('data', (chunk) => {
            res.write(chunk);
        });
        
        response.data.on('end', () => {
            res.end();
        });
        
        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            res.end();
        });
        
    } catch (error) {
        console.error('Chat API error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to process chat request',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 文件上传API路由
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
        const { user } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // 创建FormData
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        });
        formData.append('user', user);
        
        // 上传到Dify
        const response = await axios.post(
            `${config.DIFY_API_BASE_URL}/files/upload`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                    ...formData.getHeaders()
                }
            }
        );
        
        res.json(response.data);
        
    } catch (error) {
        console.error('File upload error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to upload file',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 获取会话列表
app.get('/api/conversations', async (req, res) => {
    try {
        const { user, last_id, limit = 20 } = req.query;
        
        const response = await axios.get(
            `${config.DIFY_API_BASE_URL}/conversations`,
            {
                params: { user, last_id, limit },
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`
                }
            }
        );
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Get conversations error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get conversations',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 获取会话消息历史
app.get('/api/messages', async (req, res) => {
    try {
        const { conversation_id, user, first_id, limit = 20 } = req.query;
        
        const response = await axios.get(
            `${config.DIFY_API_BASE_URL}/messages`,
            {
                params: { conversation_id, user, first_id, limit },
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`
                }
            }
        );
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Get messages error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get messages',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 删除会话
app.delete('/api/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { user } = req.body;
        
        await axios.delete(
            `${config.DIFY_API_BASE_URL}/conversations/${conversationId}`,
            {
                data: { user },
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.status(204).send();
        
    } catch (error) {
        console.error('Delete conversation error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to delete conversation',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 停止响应
app.post('/api/chat-messages/:taskId/stop', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { user } = req.body;
        
        const response = await axios.post(
            `${config.DIFY_API_BASE_URL}/chat-messages/${taskId}/stop`,
            { user },
            {
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Stop response error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to stop response',
            message: error.response?.data?.message || error.message 
        });
    }
});

// 根路径路由 - 服务index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 所有其他路径也重定向到index.html (SPA支持)
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 导出app供Vercel使用
module.exports = app;

// 只在非Vercel环境下启动服务器
if (process.env.NODE_ENV !== 'production') {
    app.listen(config.PORT, () => {
        console.log(`Server is running on http://localhost:${config.PORT}`);  
        console.log(`API Key configured: ${config.DIFY_API_KEY ? 'Yes' : 'No'}`);
    });
}