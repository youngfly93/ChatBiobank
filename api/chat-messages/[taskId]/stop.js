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
        
        const response = await fetch(
            `${config.DIFY_API_BASE_URL}/chat-messages/${taskId}/stop`,
            {
                method: 'POST',
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
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Stop response error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to stop response',
            message: error.response?.data?.message || error.message 
        });
    }
}