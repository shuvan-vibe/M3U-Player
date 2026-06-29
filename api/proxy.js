export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Prepare headers to bypass restrictions
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // Specific rules for bioscopelive to bypass 401 Unauthorized
        if (url.includes('bioscopelive.com') || url.includes('bioscopeplus.com')) {
            headers['Referer'] = 'https://www.bioscopeplus.com/';
            headers['Origin'] = 'https://www.bioscopeplus.com';
        }

        const response = await fetch(url, { headers });
        const contentType = response.headers.get('content-type') || '';
        
        const arrayBuffer = await response.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        
        // Check if the response is an M3U8 playlist
        const isM3u8 = contentType.includes('mpegurl') || url.includes('.m3u8') || url.includes('.m3u');
        
        if (isM3u8) {
            let text = buffer.toString('utf-8');
            if (text.startsWith('#EXTM3U')) {
                // Rewrite the playlist
                const lines = text.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (!line) continue;
                    
                    if (line.startsWith('#EXT-X-KEY:')) {
                        const uriMatch = line.match(/URI="([^"]+)"/);
                        if (uriMatch) {
                            let keyUrl = uriMatch[1];
                            if (!keyUrl.startsWith('http')) {
                                keyUrl = new URL(keyUrl, url).href;
                            }
                            const proxiedKeyUrl = `/api/proxy?url=${encodeURIComponent(keyUrl)}`;
                            lines[i] = line.replace(`URI="${uriMatch[1]}"`, `URI="${proxiedKeyUrl}"`);
                        }
                    } else if (!line.startsWith('#')) {
                        // URL line (segment or variant playlist)
                        let absoluteUrl = line;
                        if (!absoluteUrl.startsWith('http')) {
                            absoluteUrl = new URL(absoluteUrl, url).href;
                        }
                        
                        // If it's another playlist, proxy it. Otherwise (segments), use absolute URL directly to save bandwidth
                        if (absoluteUrl.includes('.m3u8') || absoluteUrl.includes('.m3u')) {
                            lines[i] = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                        } else {
                            lines[i] = absoluteUrl;
                        }
                    }
                }
                text = lines.join('\n');
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                return res.status(200).send(text);
            }
        }

        // For binary files (like AES keys) or other content
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.status(200).send(buffer);
        
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch the URL' });
    }
}
