const https = require('https');

const VK_TOKEN = 'vk1.a.40bEW7iBt5YEOUPBaURUA2FQBw-9B1l_kysYkrGWU2D2iEjYlxmn6ywxBWtCB_-P6rmawSvHdnc6Vwbb-L6VRhBKSc-ggJLtXGHG5mjUrZPWif_8yK7ZcCVAfyQEk97w5ZPorGItAtSrFt9MVIZrDT7DGbBAzRhMFSWhHV4xicA5hCHayOX93_FUuMQ1PKLB83uvLTYu9OlF0Iiofi1i0Q';
const VK_PEER_ID = '2000000003';

function vkApi(method, params = {}) {
    return new Promise((resolve, reject) => {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        
        const url = `https://api.vk.com/method/${method}?${query}&access_token=${VK_TOKEN}&v=5.199`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

exports.handler = async (event) => {
    // CORS заголовки
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Preflight запрос
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { message } = JSON.parse(event.body);
        
        if (!message) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
        }

        const randomId = Math.floor(Math.random() * 2147483647);
        const result = await vkApi('messages.send', {
            peer_id: VK_PEER_ID,
            message: message,
            random_id: randomId
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, result })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
