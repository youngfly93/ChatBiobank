import axios from 'axios';
import config from '../config.js';

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // 获取会话列表
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
            
        } else if (req.method === 'DELETE') {
            // 删除会话 - 从URL参数获取conversationId
            const conversationId = req.query.conversationId || req.body.conversationId;
            const { user } = req.body;
            
            if (!conversationId) {
                return res.status(400).json({ error: 'Conversation ID is required' });
            }
            
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