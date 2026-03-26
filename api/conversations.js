export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.json({ data: [], has_more: false, limit: 20 });
    }
    if (req.method === 'DELETE') {
        return res.status(204).send();
    }
    res.status(405).json({ error: 'Method not allowed' });
}
