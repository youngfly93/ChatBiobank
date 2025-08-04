import config from '../config.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { conversation_id, user, first_id, limit = 20 } = req.query;
        
        const url = new URL(`${config.DIFY_API_BASE_URL}/messages`);
        if (conversation_id) url.searchParams.append('conversation_id', conversation_id);
        if (user) url.searchParams.append('user', user);
        if (first_id) url.searchParams.append('first_id', first_id);
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
        
    } catch (error) {
        console.error('Messages API error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get messages',
            message: error.response?.data?.message || error.message 
        });
    }
}