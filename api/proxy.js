export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Fetch the target URL acting as VLC to bypass some blocks
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18'
            }
        });
        
        const content = await response.text();

        // Allow any website (your frontend) to read this response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        
        // Return the content
        res.status(200).send(content);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch the URL' });
    }
}
