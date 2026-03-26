module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { file, user } = req.body;

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const fileData = {
            id: 'mock-file-' + Date.now(),
            url: '/placeholder-image.png',
            name: file.name || 'uploaded-file',
            type: 'image'
        };

        res.status(200).json(fileData);
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            error: 'File upload failed',
            message: error.message
        });
    }
};
