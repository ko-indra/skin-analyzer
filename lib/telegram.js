const FormData = require('form-data');

function buildCaption() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date());

    const get = (type) => parts.find((p) => p.type === type).value;
    const ms = String(new Date().getMilliseconds()).padStart(3, '0');

    return `raw-${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}:${ms}`;
}

async function sendPhotoToTelegram(dataUrl) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured');
    }

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const caption = buildCaption();

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('photo', buffer, { filename: 'selfie.png', contentType: 'image/png' });

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
        throw new Error(`Telegram API error: ${result.description || response.statusText}`);
    }

    return { caption };
}

module.exports = { sendPhotoToTelegram, buildCaption };
