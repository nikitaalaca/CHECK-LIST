const fetch = require('node-fetch');

const VK_TOKEN = 'vk1.a.40bEW7iBt5YEOUPBaURUA2FQBw-9B1l_kysYkrGWU2D2iEjYlxmn6ywxBWtCB_-P6rmawSvHdnc6Vwbb-L6VRhBKSc-ggJLtXGHG5mjUrZPWif_8yK7ZcCVAfyQEk97w5ZPorGItAtSrFt9MVIZrDT7DGbBAzRhMFSWhHV4xicA5hCHayOX93_FUuMQ1PKLB83uvLTYu9OlF0Iiofi1i0Q';
const VK_PEER_ID = '2000000003';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message } = JSON.parse(event.body);

        // Отправляем текстовое сообщение
        const randomId = Math.floor(Math.random() * 2147483647);
        const textUrl = `https://api.vk.com/method/messages.send?peer_id=${VK_PEER_ID}&message=${encodeURIComponent(message)}&random_id=${randomId}&access_token=${VK_TOKEN}&v=5.199`;
        await fetch(textUrl);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
