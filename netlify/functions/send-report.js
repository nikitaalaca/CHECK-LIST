const https = require('https');
const querystring = require('querystring');

const VK_TOKEN = 'vk1.a.40bEW7iBt5YEOUPBaURUA2FQBw-9B1l_kysYkrGWU2D2iEjYlxmn6ywxBWtCB_-P6rmawSvHdnc6Vwbb-L6VRhBKSc-ggJLtXGHG5mjUrZPWif_8yK7ZcCVAfyQEk97w5ZPorGItAtSrFt9MVIZrDT7DGbBAzRhMFSWhHV4xicA5hCHayOX93_FUuMQ1PKLB83uvLTYu9OlF0Iiofi1i0Q';
const VK_PEER_ID = '2000000003';

function vkGet(method, params = {}) {
    return new Promise((resolve, reject) => {
        const qs = querystring.stringify({ ...params, access_token: VK_TOKEN, v: '5.199' });
        const url = `https://api.vk.com/method/${method}?${qs}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function uploadFile(url, fileBuffer, filename) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        const body = Buffer.concat([Buffer.from(header), fileBuffer, Buffer.from(footer)]);

        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const contentType = event.headers['content-type'] || '';

        let message = '';
        let pdfBase64 = null;
        let photoBase64List = [];

        if (contentType.includes('application/json')) {
            const json = JSON.parse(event.body);
            message = json.message || '';
            pdfBase64 = json.pdf || null;
            photoBase64List = json.photos || [];
        }

        // 1. Отправляем текстовое сообщение
        const randomId = Math.floor(Math.random() * 2147483647);
        console.log('Отправка текста...');
        await vkGet('messages.send', {
            peer_id: VK_PEER_ID,
            message: message,
            random_id: randomId
        });

        // 2. Отправляем PDF как документ
        if (pdfBase64) {
            try {
                console.log('Загрузка PDF...');
                const pdfBuffer = Buffer.from(pdfBase64, 'base64');

                const docUploadServer = await vkGet('docs.getMessagesUploadServer', {
                    peer_id: VK_PEER_ID,
                    type: 'doc'
                });

                if (docUploadServer.response && docUploadServer.response.upload_url) {
                    const uploadResult = await uploadFile(docUploadServer.response.upload_url, pdfBuffer, 'checklist_report.pdf');
                    
                    if (uploadResult.file) {
                        const saveResult = await vkGet('docs.save', { file: uploadResult.file });
                        
                        if (saveResult.response && saveResult.response.doc) {
                            const doc = saveResult.response.doc;
                            const attachment = `doc${doc.owner_id}_${doc.id}`;
                            
                            await vkGet('messages.send', {
                                peer_id: VK_PEER_ID,
                                attachment: attachment,
                                random_id: Math.floor(Math.random() * 2147483647)
                            });
                            console.log('PDF отправлен!');
                        }
                    }
                }
            } catch (e) {
                console.error('Ошибка загрузки PDF:', e.message);
            }
        }

        // 3. Отправляем фото
        if (photoBase64List && photoBase64List.length > 0) {
            for (const photoBase64 of photoBase64List) {
                try {
                    console.log('Загрузка фото...');
                    const photoBuffer = Buffer.from(photoBase64, 'base64');

                    const photoUploadServer = await vkGet('photos.getMessagesUploadServer', {
                        peer_id: VK_PEER_ID
                    });

                    if (photoUploadServer.response && photoUploadServer.response.upload_url) {
                        const uploadResult = await uploadFile(photoUploadServer.response.upload_url, photoBuffer, 'photo.jpg');
                        
                        if (uploadResult.photo) {
                            const saveResult = await vkGet('photos.saveMessagesPhoto', {
                                photo: uploadResult.photo,
                                server: uploadResult.server,
                                hash: uploadResult.hash
                            });

                            if (saveResult.response && saveResult.response[0]) {
                                const photo = saveResult.response[0];
                                const attachment = `photo${photo.owner_id}_${photo.id}`;
                                
                                await vkGet('messages.send', {
                                    peer_id: VK_PEER_ID,
                                    attachment: attachment,
                                    random_id: Math.floor(Math.random() * 2147483647)
                                });
                                console.log('Фото отправлено!');
                            }
                        }
                    }
                } catch (e) {
                    console.error('Ошибка загрузки фото:', e.message);
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Ошибка:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
