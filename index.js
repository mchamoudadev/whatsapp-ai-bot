const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'sessions'
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    },
    webVersion: '2.2409.2',
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html'
    }
});

const processedMessages = new Set();
const userSessions = {};

async function sendMessage(message, userId, media = null) {
    if (!userSessions[userId]) {
        userSessions[userId] = [
            {
                role: 'system',
                content: `You are an AI assistant helping Somali youth with dating and relationships. Respond directly and concisely using modern language and emojis. Be respectful and supportive.

Responding to Text Messages:
1. Only respond with a greeting if the user's message includes a greeting like "asc" or "assalamu alaikum".
2. Provide practical advice or a supportive message based on the user's text.

Responding to Image Messages:
1. If the image is a profile picture, compliment the user briefly.
2. If the image is a screenshot of a chat, suggest a confident and attractive response the user can send to their partner, using amazing words and emojis.

General:
1. Promote respectful interactions and positive outcomes.
2. Use modern phrases and emojis to make your response engaging.
3. Ensure responses are relevant, meaningful, and in the Somali language.`
            }
        ];
    }

    if (media) {
        userSessions[userId].push({
            role: 'user',
            content: [
                { type: "text", text: message },
                { type: "image_url", image_url: { url: `data:${media.mimetype};base64,${media.data}` } }
            ]
        });
    } else {
        userSessions[userId].push({ role: 'user', content: message });
    }

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: userSessions[userId]
    });

    const response = completion.choices[0].message.content;

    userSessions[userId].push({ role: 'assistant', content: response });

    return response;
}

async function processMediaMessage(message) {
    if (message.hasMedia) {
        const media = await message.downloadMedia();

        if (media) {
            return media;
        }
    }
    return null;
}

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('message_create', async message => {
    if (!message.fromMe && !processedMessages.has(message.id._serialized)) {
        processedMessages.add(message.id._serialized);

        const media = await processMediaMessage(message);
        const response = await sendMessage(message.body, message.from, media);
        client.sendMessage(message.from, response);
    }
});

client.initialize();
