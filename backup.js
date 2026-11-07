// ALTRO SALE UC BOT — Cloud Auto-Backup & Restore via Telegram
const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
let isBackingUp = false;
let lastBackupHash = '';

// Restore database from Telegram pinned backup on container startup
async function restoreDatabaseIfMissing(bot, ownerId) {
    if (!bot || !ownerId) return false;

    // If local database already exists with valid data (> 4KB), skip download
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 4096) {
        console.log('📦 Lokal database.sqlite mavjud, tiklash shart emas.');
        return true;
    }

    console.log('🔄 Render yangi konteyner: Telegramdan zaxira bazani yuklab olish tekshirilmoqda...');
    try {
        const chat = await bot.telegram.getChat(ownerId);
        const fileId = chat.pinned_message?.document?.file_id;

        if (!fileId) {
            console.log('ℹ️ Telegramda qadalgan zaxira baza topilmadi. Yangi baza yaratiladi.');
            return false;
        }

        const fileLink = await bot.telegram.getFileLink(fileId);
        console.log('⬇️ Telegramdan oxirgi zaxira yuklanmoqda...');

        await new Promise((resolve, reject) => {
            const tempPath = DB_PATH + '.downloading';
            const fileStream = fs.createWriteStream(tempPath);

            https.get(fileLink.href, (response) => {
                if (response.statusCode !== 200) {
                    fileStream.close();
                    fs.unlinkSync(tempPath);
                    return reject(new Error(`Yuklab olish xatosi: ${response.statusCode}`));
                }

                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    if (fs.existsSync(DB_PATH)) {
                        try { fs.unlinkSync(DB_PATH); } catch (e) {}
                    }
                    fs.renameSync(tempPath, DB_PATH);
                    console.log('✅ Zaxira muvaffaqiyatli tiklandi! Hajmi:', fs.statSync(DB_PATH).size, 'bayt');
                    resolve();
                });
            }).on('error', (err) => {
                fileStream.close();
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
                reject(err);
            });
        });

        return true;
    } catch (err) {
        console.warn('⚠️ Telegramdan tiklashda xatolik:', err.message);
        return false;
    }
}

// Upload current database.sqlite to Telegram and pin it quietly
async function backupDatabase(bot, ownerId, reason = 'auto') {
    if (!bot || !ownerId || isBackingUp) return;
    if (!fs.existsSync(DB_PATH)) return;

    // Checkpoint WAL journal into main sqlite file so all latest data is flushed
    try {
        const { db } = require('./database');
        if (db && typeof db.pragma === 'function') {
            db.pragma('wal_checkpoint(TRUNCATE)');
        }
    } catch (e) {}

    const stats = fs.statSync(DB_PATH);
    if (stats.size < 4096) return;

    isBackingUp = true;
    try {
        const timestamp = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
        const caption = `💾 #DB_BACKUP — ALTRO SALE UC BOT\n` +
                        `⏰ Vaqt: ${timestamp}\n` +
                        `📦 Hajmi: ${(stats.size / 1024).toFixed(1)} KB\n` +
                        `📌 Sabab: ${reason}`;

        // Send database file
        const msg = await bot.telegram.sendDocument(ownerId, {
            source: DB_PATH,
            filename: 'database.sqlite'
        }, {
            caption,
            disable_notification: true
        });

        // Pin the latest backup message quietly
        if (msg && msg.message_id) {
            await bot.telegram.pinChatMessage(ownerId, msg.message_id, {
                disable_notification: true
            });
            console.log(`💾 Telegram zaxirasi saqlandi (#${msg.message_id}, ${reason})`);
        }
    } catch (err) {
        console.warn('⚠️ Zaxirani Telegramga yuborishda xatolik:', err.message);
    } finally {
        isBackingUp = false;
    }
}

module.exports = {
    restoreDatabaseIfMissing,
    backupDatabase
};
