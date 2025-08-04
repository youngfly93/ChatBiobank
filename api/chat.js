import config from '../config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        console.log('Sending request to Dify API:', config.DIFY_API_BASE_URL);
        console.log('Request data:', JSON.stringify(requestData, null, 2));

        const response = await fetch(`${config.DIFY_API_BASE_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        // 转发流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
            }
        } finally {
            reader.releaseLock();
            res.end();
        }

    } catch (error) {
        console.error('Error in chat API:', error.message);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}