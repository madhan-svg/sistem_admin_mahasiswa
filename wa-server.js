const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.text()); // To accept text/plain from no-cors fetch
app.use(express.json());

// Initialize WhatsApp Client
console.log("Inisialisasi WhatsApp Client...");
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'wa-session'
    }),
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n=== SILAKAN SCAN QR CODE INI MENGGUNAKAN WHATSAPP HP ANDA ===\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅ WhatsApp Client sudah siap dan terhubung!\n');
});

client.on('auth_failure', msg => {
    console.error('❌ Otentikasi gagal:', msg);
});

client.initialize();

// REST API Endpoint
app.post('/send-wa', async (req, res) => {
    try {
        let payload;
        // Parse payload if it comes as text/plain
        if (typeof req.body === 'string') {
            payload = JSON.parse(req.body);
        } else {
            payload = req.body;
        }

        const targetNumber = '6285262609638'; // The requested number
        const formattedNumber = targetNumber + '@c.us';

        let message = '';
        if (payload.action === 'input_nilai') {
            message = `*Notifikasi Nilai Baru!*\n\n` +
                `👨‍🎓 *NIM:* ${payload.nim}\n` +
                `👤 *Nama:* ${payload.nama}\n` +
                `📚 *Mata Kuliah:* ${payload.matkul}\n` +
                `📈 *SKS:* ${payload.sks}\n` +
                `✨ *Nilai:* ${payload.nilaiHuruf}\n` +
                `🎓 *IPK Saat Ini:* ${payload.ipk}\n\n` +
                `_Data berhasil direkam oleh Sistem Nilai._`;
        } else if (payload.action === 'master_matkul') {
            message = `*Mata Kuliah Baru Ditambahkan!*\n\n` +
                `🔖 *Kode:* ${payload.kode}\n` +
                `📚 *Nama:* ${payload.namaMK}\n` +
                `📈 *SKS:* ${payload.sks}\n\n` +
                `_Data berhasil direkam oleh Sistem Nilai._`;
        }

        if (message) {
            await client.sendMessage(formattedNumber, message);
            console.log(`Berhasil mengirim pesan ke ${targetNumber}`);
            res.json({ success: true, message: 'Message sent' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid action' });
        }
    } catch (err) {
        console.error('Gagal mengirim pesan:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 WA Server berjalan di http://localhost:${port}`);
});
