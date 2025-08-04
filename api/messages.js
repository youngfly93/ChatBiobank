import axios from 'axios';
import config from '../config.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
        console.error('Messages API error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get messages',
            message: error.response?.data?.message || error.message 
        });
    }
}