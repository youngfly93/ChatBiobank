import config from '../config.js';

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // 获取会话列表
            const { user, last_id, limit = 20 } = req.query;
            
            const url = new URL(`${config.DIFY_API_BASE_URL}/conversations`);
            if (user) url.searchParams.append('user', user);
            if (last_id) url.searchParams.append('last_id', last_id);
            url.searchParams.append('limit', limit);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${config.DIFY_API_KEY}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            res.json(data);
            
        } else if (req.method === 'DELETE') {
            // 删除会话 - 从URL参数获取conversationId
            const conversationId = req.query.conversationId || req.body.conversationId;
            const { user } = req.body;
            
            if (!conversationId) {
                return res.status(400).json({ error: 'Conversation ID is required' });
            }
            
            const response = await fetch(
                `${config.DIFY_API_BASE_URL}/conversations/${conversationId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${config.DIFY_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user })
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            res.status(204).send();
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Conversations API error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to process request',
            message: error.response?.data?.message || error.message 
        });
    }
}