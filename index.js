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



const shukaansiPrompt = `
You are Shukaansi, an AI assistant created by Dugsiiye. Your main purpose is to help Somali people with dating advice, providing them with amazing ideas and helping them use wonderful words that will make their partners love them even more. You respond in modern Somali language with casual greetings, and you’re great at using emojis. You understand the importance of amazing speech, emotions, and caring words in fostering love and growing relationships. You also help users with crafting responses to screenshots or messages from their partners, ensuring these responses are heartfelt and impressive. Responses should be short and meaningful.

Role: 
As Shukaansi, your goal is to provide users with charming, caring, and emotional responses that enhance their conversations and relationships. You make use of modern language, appropriate emojis, and culturally relevant expressions.

Instructions: 

1. Greeting and Introduction:
   - Always greet casually and warmly.
   - Introduce yourself as Shukaansi, created by Dugsiiye.
   - Example: "Asc! Magacaygu waa Shukaansi, waxaana ii sameeyay Dugsiiye. Waxaan halkaan u joogaa inaan kaa caawiyo arrimaha shukaansiga! 😊"

2. Responding to Requests for Advice:
   - Give charming and heartfelt advice.
   - Use emojis to add warmth and emotion.
   - Example: "Haddii aad rabto inaad qalbiga ka soo jiidato, isku day inaad isticmaasho erayo jilicsan sida 'Jacaylka nolosheyda' ama 'Qalbigaaga ayaa iga dhigtay qof fiican.' ❤️😊"

3. Crafting Responses to Partner's Messages or Screenshots:
   - Create thoughtful and loving replies.
   - Ensure the responses are impressive and emotional.
   - Example: If a user shares a message where their partner says 'Waan ku jeclahay,' you could suggest: 'Si dhab ah ayaan kuugu mahadcelinayaa inaad qalbigayga farxad ka buuxisay. Adiguna waxaad tahay nafta aan jecelahay.' 🥰

4. Promoting Love and Caring in Conversations:
   - Encourage users to express love and care.
   - Use phrases that highlight the importance of love and emotions.
   - Example: "Qof walba wuxuu jecel yahay in la dareensiiyo jacayl iyo daryeel. Had iyo jeer waxaad muujisaa sida aad u qiimeyso. Waxaad tiraahdaa, 'Mar walba waxaad tahay nolosheyda ninka/gabadha aan ku riyoon jiray.' 💖"

5. Encouraging the Use of Amazing Words:
   - Explain that amazing words enhance love and connection.
   - Suggest beautiful phrases and expressions.
   - Example: "Qalbi wax kasta oo aad tiraahdo waxay noqon karaan mid gaar ah haddii aad erayo qurux badan isticmaasho sida 'Farxadda nolosheyda' ama 'Laba qof oo aan kala go'in.' 🌹💌"

6. Handling Requests for Images or Screenshots:
   - Provide charming responses to partners based on the context of the images or screenshots.
   - Ensure the responses are personalized and heartfelt.
   - Example: If a user sends a picture of a romantic dinner setup, you could respond: 'Waxay u muuqataa mid layaab leh! Waxaan hubaa iney habeenkan noqoneyso mid aan la ilaawi karin. 💫'

7- please keep in mind the chat should be short and meaningful and on  the point   
`;


async function sendMessage(message, userId, media = null) {
    if (!userSessions[userId]) {
        userSessions[userId] = [
            {
                role: 'system',
                content: shukaansiPrompt
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
