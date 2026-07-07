const fetch = require('node-fetch');
const FormData = require('form-data');

const VK_TOKEN = 'vk1.a.40bEW7iBt5YEOUPBaURUA2FQBw-9B1l_kysYkrGWU2D2iEjYlxmn6ywxBWtCB_-P6rmawSvHdnc6Vwbb-L6VRhBKSc-ggJLtXGHG5mjUrZPWif_8yK7ZcCVAfyQEk97w5ZPorGItAtSrFt9MVIZrDT7DGbBAzRhMFSWhHV4xicA5hCHayOX93_FUuMQ1PKLB83uvLTYu9OlF0Iiofi1i0Q';
const VK_PEER_ID = '2000000003';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const contentType = event.headers['content-type'] || '';
        
        let message = '';
        let pdfBuffer = null;
        let photoBuffers = [];

        if (contentType.includes('multipart/form-data')) {
            // Парсим FormData вручную (Netlify не поддерживает multer)
            const body = event.body;
            const boundary = contentType.split('boundary=')[1];
            const parts = body.split('--' + boundary);
            
            for (const part of parts) {
                if (part.includes('Content-Disposition')) {
                    const nameMatch = part.match(/name="([^"]+)"/);
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    const name = nameMatch ? nameMatch[1] : '';
                    
                    if (name === 'message') {
                        message = part.split('\r\n\r\n')[1]?.split('--')[0]?.trim() || '';
                    } else if (name === 'pdf' && filenameMatch) {
                        const dataStart = part.indexOf('\r\n\r\n') + 4;
                        const data = part.substring(dataStart).split('--')[0];
                        pdfBuffer = Buffer.from(data, 'binary');
                    } else if (name === 'photos' && filenameMatch) {
                        const dataStart = part.indexOf('\r\n\r\n') + 4;
                        const data = part.substring(dataStart).split('--')[0];
                        photoBuffers.push(Buffer.from(data, 'binary'));
                    }
                }
            }
        } else {
            const json = JSON.parse(event.body);
            message = json.message || '';
        }

        // 1. Отправляем текст
        const randomId = Math.floor(Math.random() * 2147483647);
        const textUrl = `https://api.vk.com/method/messages.send?peer_id=${VK_PEER_ID}&message=${encodeURIComponent(message)}&random_id=${randomId}&access_token=${VK_TOKEN}&v=5.199`;
        await fetch(textUrl);

        // 2. Загружаем PDF как документ
        if (pdfBuffer) {
            const uploadDocUrl = `https://api.vk.com/method/docs.getMessagesUploadServer?type=doc&peer_id=${VK_PEER_ID}&access_token=${VK_TOKEN}&v=5.199`;
            const uploadDocRes = await fetch(uploadDocUrl);
            const uploadDocData = await uploadDocRes.json();

            if (uploadDocData.response) {
                const form = new FormData();
                form.append('file', pdfBuffer, 'report.pdf');
                const uploadRes = await fetch(uploadDocData.response.upload_url, { method: 'POST', body: form });
                const uploadData = await uploadRes.json();

                const saveUrl = `https://api.vk.com/method/docs.save?file=${uploadData.file}&access_token=${VK_TOKEN}&v=5.199`;
                const saveRes = await fetch(saveUrl);
                const saveData = await saveRes.json();

                if (saveData.response) {
                    const attachment = `doc${saveData.response.doc.owner_id}_${saveData.response.doc.id}`;
                    const sendUrl = `https://api.vk.com/method/messages.send?peer_id=${VK_PEER_ID}&attachment=${attachment}&random_id=${Math.floor(Math.random()*2147483647)}&access_token=${VK_TOKEN}&v=5.199`;
                    await fetch(sendUrl);
                }
            }
        }

        // 3. Загружаем фото
        for (const photo of photoBuffers) {
            const uploadPhotoUrl = `https://api.vk.com/method/photos.getMessagesUploadServer?peer_id=${VK_PEER_ID}&access_token=${VK_TOKEN}&v=5.199`;
            const uploadPhotoRes = await fetch(uploadPhotoUrl);
            const uploadPhotoData = await uploadPhotoRes.json();

            if (uploadPhotoData.response) {
                const form = new FormData();
                form.append('photo', photo, 'photo.jpg');
                const upRes = await fetch(uploadPhotoData.response.upload_url, { method: 'POST', body: form });
                const upData = await upRes.json();

                const savePhotoUrl = `https://api.vk.com/method/photos.saveMessagesPhoto?photo=${upData.photo}&server=${upData.server}&hash=${upData.hash}&access_token=${VK_TOKEN}&v=5.199`;
                const savePhotoRes = await fetch(savePhotoUrl);
                const savePhotoData = await savePhotoRes.json();

                if (savePhotoData.response) {
                    const att = `photo${savePhotoData.response[0].owner_id}_${savePhotoData.response[0].id}`;
                    const sendUrl = `https://api.vk.com/method/messages.send?peer_id=${VK_PEER_ID}&attachment=${att}&random_id=${Math.floor(Math.random()*2147483647)}&access_token=${VK_TOKEN}&v=5.199`;
                    await fetch(sendUrl);
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
