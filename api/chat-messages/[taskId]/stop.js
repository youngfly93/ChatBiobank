import axios from 'axios';
import config from '../../../config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { taskId } = req.query;
        const { user } = req.body;
        
        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required' });
        }
        
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
}