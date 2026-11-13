const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
require('dotenv').config();

const { db, users, withdrawals, admins, settings, tasks, channels, packages } = require('./database');
const { bot, checkUserSubscription, clearSubCache, normalizeChannelData, notifyWithdrawalUpdate, notifyAdminsNewWithdrawal, broadcastMessage } = require('./bot');
const { restoreDatabaseIfMissing, backupDatabase } = require('./backup');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_ID = process.env.OWNER_ID ? parseInt(process.env.OWNER_ID.trim()) : 7081580477;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-seed owner and admins from .env
if (process.env.OWNER_ID) {
    const ownerId = parseInt(process.env.OWNER_ID.trim());
    if (!isNaN(ownerId)) {
        admins.add(ownerId, 'Loyiha Egasi (Owner)', 'owner');
    }
}
if (process.env.ADMIN_IDS) {
    const adminIds = process.env.ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean);
    const ownerIdNum = process.env.OWNER_ID ? parseInt(process.env.OWNER_ID.trim()) : null;
    for (const aId of adminIds) {
        if (!isNaN(aId)) {
            const idNum = parseInt(aId);
            if (idNum === ownerIdNum) {
                admins.add(idNum, 'Loyiha Egasi (Owner)', 'owner');
            } else {
                admins.add(idNum, 'Admin', 'admin');
            }
        }
    }
}

// ----------------- USER APIS -----------------

// Initialize User / Get State
app.post('/api/user/init', async (req, res) => {
    try {
        const { telegram_id, username, first_name, last_name, referrer_id } = req.body;
        if (!telegram_id) {
            return res.status(400).json({ error: 'telegram_id is required' });
        }

        const user = users.getOrCreate(telegram_id, {
            username,
            first_name,
            last_name,
            referrer_id
        });

        const maxEnergy = 1000 + (user.energy_limit_level - 1) * 500;
        const rank = users.getUserRank(telegram_id);
        const userPackages = packages.getAll();
        const userTasks = tasks.getAll(telegram_id);
        const mandatoryChannels = channels.getAll();
        const isAdmin = admins.isAdmin(telegram_id);

        // 100% strict channel subscription check
        let isSubscribed = true;
        let missingChannels = [];
        const isMandatoryActive = settings.get('channel_mandatory_active') !== '0';
        if (isMandatoryActive && mandatoryChannels.length > 0) {
            const subCheck = await checkUserSubscription(telegram_id);
            isSubscribed = subCheck.allSubscribed;
            missingChannels = subCheck.missing;
        }

        res.json({
            success: true,
            user: {
                ...user,
                max_energy: maxEnergy,
                rank
            },
            packages: userPackages,
            tasks: userTasks,
            mandatory_channels: mandatoryChannels,
            is_admin: isAdmin,
            is_subscribed: isSubscribed,
            missing_channels: missingChannels,
            settings: {
                referral_bonus: settings.get('referral_bonus') || 500,
                bot_name: settings.get('bot_name') || 'ALTRO SALE UC BOT',
                bot_username: process.env.BOT_USERNAME || 'altrosaleucbot',
                support_username: 'ALTRO_ADMN',
                support_link: 'https://t.me/ALTRO_ADMN'
            }
        });
    } catch (err) {
        console.error('Init error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Check channel subscription status live
app.post('/api/user/check-sub', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        if (!telegram_id) {
            return res.status(400).json({ error: 'telegram_id talab qilinadi' });
        }

        clearSubCache(telegram_id);
        const subCheck = await checkUserSubscription(telegram_id, true);

        res.json({
            success: true,
            is_subscribed: subCheck.allSubscribed,
            missing_channels: subCheck.missing
        });
    } catch (err) {
        console.error('Check sub error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Process Taps (Batch sync)
app.post('/api/user/tap', async (req, res) => {
    try {
        const { telegram_id, taps } = req.body;
        if (!telegram_id || !taps || taps <= 0) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        // Channel subscription check
        const isMandatoryActive = settings.get('channel_mandatory_active') !== '0';
        if (isMandatoryActive && channels.getAll().length > 0) {
            const subCheck = await checkUserSubscription(telegram_id);
            if (!subCheck.allSubscribed) {
                return res.status(403).json({
                    error: 'Iltimos, avval rasmiy kanallarga a\'zo bo\'ling!',
                    is_subscribed: false,
                    missing_channels: subCheck.missing
                });
            }
        }

        const result = users.syncTaps(telegram_id, taps);
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error('Tap error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Boosts / Upgrades
app.post('/api/user/upgrade', async (req, res) => {
    try {
        const { telegram_id, type } = req.body;
        if (!telegram_id || !type) {
            return res.status(400).json({ error: 'telegram_id and type are required' });
        }

        // Channel subscription check
        const isMandatoryActive = settings.get('channel_mandatory_active') !== '0';
        if (isMandatoryActive && channels.getAll().length > 0) {
            const subCheck = await checkUserSubscription(telegram_id);
            if (!subCheck.allSubscribed) {
                return res.status(403).json({
                    error: 'Iltimos, avval rasmiy kanallarga a\'zo bo\'ling!',
                    is_subscribed: false,
                    missing_channels: subCheck.missing
                });
            }
        }

        let result;
        if (type === 'multitap') {
            result = users.upgradeMultitap(telegram_id);
        } else if (type === 'energy_limit') {
            result = users.upgradeEnergyLimit(telegram_id);
        } else if (type === 'recharge_speed') {
            result = users.upgradeRechargeSpeed(telegram_id);
        } else if (type === 'free_boost') {
            result = users.useFreeBoost(telegram_id);
        } else {
            return res.status(400).json({ error: 'Unknown upgrade type' });
        }

        if (!result.success) {
            return res.status(400).json(result);
        }

        const maxEnergy = 1000 + (result.user.energy_limit_level - 1) * 500;
        res.json({
            success: true,
            user: {
                ...result.user,
                max_energy: maxEnergy
            },
            cost: result.cost || 0
        });
    } catch (err) {
        console.error('Upgrade error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save PUBG ID & Nickname
app.post('/api/user/pubg-info', (req, res) => {
    try {
        const { telegram_id, pubg_id, pubg_name } = req.body;
        if (!telegram_id || !pubg_id) {
            return res.status(400).json({ error: 'telegram_id and pubg_id required' });
        }

        const updated = users.updatePubgInfo(telegram_id, pubg_id, pubg_name || '');
        res.json({ success: true, user: updated });
    } catch (err) {
        console.error('PUBG Info error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Complete Task (e.g. YouTube obuna -> +200 Altro)
app.post('/api/tasks/complete', (req, res) => {
    try {
        const { telegram_id, task_id } = req.body;
        if (!telegram_id || !task_id) {
            return res.status(400).json({ error: 'telegram_id and task_id required' });
        }

        const result = tasks.complete(telegram_id, task_id);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (err) {
        console.error('Task complete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Leaderboard / Reyting
app.get('/api/leaderboard', (req, res) => {
    try {
        const telegram_id = req.query.telegram_id;
        const list = users.getLeaderboard(100);
        let userRank = null;
        if (telegram_id) {
            userRank = users.getUserRank(telegram_id);
        }

        res.json({
            success: true,
            leaderboard: list,
            user_rank: userRank
        });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------- WITHDRAWAL APIS -----------------

// Create Withdrawal Request
app.post('/api/withdraw/request', async (req, res) => {
    try {
        const { telegram_id, package_id, pubg_id, pubg_name } = req.body;
        if (!telegram_id || !package_id || !pubg_id) {
            return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
        }

        // Channel subscription check
        const isMandatoryActive = settings.get('channel_mandatory_active') !== '0';
        if (isMandatoryActive && channels.getAll().length > 0) {
            const subCheck = await checkUserSubscription(telegram_id, true);
            if (!subCheck.allSubscribed) {
                return res.status(403).json({
                    error: 'UC yechish uchun avval rasmiy kanallarga a\'zo bo\'lishingiz shart!',
                    is_subscribed: false,
                    missing_channels: subCheck.missing
                });
            }
        }

        const result = withdrawals.create(telegram_id, package_id, pubg_id, pubg_name);
        if (!result.success) {
            return res.status(400).json(result);
        }

        const updatedUser = users.getById(telegram_id);

        // Notify admins asynchronously about new withdrawal request
        notifyAdminsNewWithdrawal({
            user_id: telegram_id,
            pubg_id,
            pubg_name,
            uc_amount: result.uc,
            altro_spent: result.altro_spent || 0
        }).catch(err => console.warn('Admin notification error:', err.message));

        // Save cloud backup immediately so new withdrawal is never lost
        backupDatabase(bot, OWNER_ID, 'yangi_ariza');

        res.json({
            success: true,
            message: `Ariza qabul qilindi! ${result.uc} PUBG UC tez orada hisobingizga o'tkaziladi.`,
            withdrawal_id: result.withdrawalId,
            user: updatedUser
        });
    } catch (err) {
        console.error('Withdraw request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// User Withdrawal History
app.get('/api/withdraw/history', (req, res) => {
    try {
        const { telegram_id } = req.query;
        if (!telegram_id) {
            return res.status(400).json({ error: 'telegram_id is required' });
        }

        const history = withdrawals.getUserWithdrawals(telegram_id);
        res.json({ success: true, history });
    } catch (err) {
        console.error('Withdraw history error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------- ADMIN APIS -----------------

// Admin auth middleware
function requireAdmin(req, res, next) {
    const adminId = req.headers['x-admin-id'] || req.query.admin_id || req.body.admin_id;
    if (!adminId || !admins.isAdmin(parseInt(adminId))) {
        return res.status(403).json({ error: 'Ruxsat etilmagan: Siz admin emassiz' });
    }
    next();
}

// Admin Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
        const totalAltro = db.prepare('SELECT SUM(altro_balance) as s FROM users').get().s || 0;
        const totalUcWithdrawn = db.prepare('SELECT SUM(total_uc_withdrawn) as s FROM users').get().s || 0;
        const pendingWithdrawals = db.prepare("SELECT COUNT(*) as c FROM withdrawals WHERE status = 'pending'").get().c;
        const totalWithdrawals = db.prepare('SELECT COUNT(*) as c FROM withdrawals').get().c;

        res.json({
            success: true,
            stats: {
                total_users: totalUsers,
                total_altro: Math.floor(totalAltro),
                total_uc_withdrawn: totalUcWithdrawn,
                pending_withdrawals: pendingWithdrawals,
                total_withdrawals: totalWithdrawals
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UC Packages Admin
app.get('/api/admin/packages', requireAdmin, (req, res) => {
    res.json({ success: true, packages: packages.getAll() });
});

app.post('/api/admin/packages', requireAdmin, (req, res) => {
    const { altro_cost, uc_amount, title, badge } = req.body;
    if (!altro_cost || !uc_amount) {
        return res.status(400).json({ error: 'Altro narxi va UC miqdori kiritilishi shart' });
    }
    const id = packages.add(altro_cost, uc_amount, title, badge);
    res.json({ success: true, id, packages: packages.getAll() });
});

app.put('/api/admin/packages/:id', requireAdmin, (req, res) => {
    const { altro_cost, uc_amount, title, badge } = req.body;
    packages.update(req.params.id, altro_cost, uc_amount, title, badge);
    res.json({ success: true, packages: packages.getAll() });
});

app.delete('/api/admin/packages/:id', requireAdmin, (req, res) => {
    packages.delete(req.params.id);
    res.json({ success: true, packages: packages.getAll() });
});

// Withdrawal Requests Admin
app.get('/api/admin/withdrawals', requireAdmin, (req, res) => {
    const status = req.query.status || null;
    const list = withdrawals.getAll(status);
    res.json({ success: true, withdrawals: list });
});

app.post('/api/admin/withdrawals/:id/status', requireAdmin, async (req, res) => {
    const { status, note } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Noto\'g\'ri status' });
    }

    const result = withdrawals.updateStatus(req.params.id, status, note);
    if (!result.success) {
        return res.status(400).json(result);
    }

    // Send Telegram Notification to user
    const w = result.withdrawal;
    await notifyWithdrawalUpdate(w.user_id, w.uc_amount, w.pubg_id, status, note, w.pubg_name);

    res.json({ success: true, withdrawal: w });
});

// User Search & Balance Edit Admin
app.get('/api/admin/users', requireAdmin, (req, res) => {
    const query = req.query.q || '';
    let usersList;
    if (query) {
        usersList = db.prepare(`
            SELECT * FROM users 
            WHERE telegram_id LIKE ? OR username LIKE ? OR first_name LIKE ? OR pubg_id LIKE ?
            LIMIT 50
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    } else {
        usersList = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all();
    }
    res.json({ success: true, users: usersList });
});

app.post('/api/admin/users/balance', requireAdmin, (req, res) => {
    const { telegram_id, altro_balance } = req.body;
    if (!telegram_id || isNaN(altro_balance)) {
        return res.status(400).json({ error: 'telegram_id va altro_balance kiritilishi shart' });
    }

    db.prepare('UPDATE users SET altro_balance = ? WHERE telegram_id = ?').run(Number(altro_balance), telegram_id);
    const updated = users.getById(telegram_id);
    res.json({ success: true, user: updated });
});

// Mandatory Channels Admin
app.get('/api/admin/channels', requireAdmin, (req, res) => {
    res.json({ success: true, channels: channels.getAll() });
});

app.post('/api/admin/channels', requireAdmin, (req, res) => {
    const { title, channel_username, invite_link } = req.body;
    if (!title || !channel_username) {
        return res.status(400).json({ error: 'Sarlavha va kanal username kiritilishi shart' });
    }
    const normalized = normalizeChannelData(channel_username, invite_link);
    const id = channels.add(title.trim(), normalized.channel_username, normalized.invite_link);
    clearSubCache();
    res.json({ success: true, id, channels: channels.getAll() });
});

app.put('/api/admin/channels/:id', requireAdmin, (req, res) => {
    const { title, channel_username, invite_link } = req.body;
    if (!title || !channel_username) {
        return res.status(400).json({ error: 'Sarlavha va kanal username kiritilishi shart' });
    }
    const normalized = normalizeChannelData(channel_username, invite_link);
    channels.update(req.params.id, title.trim(), normalized.channel_username, normalized.invite_link);
    clearSubCache();
    res.json({ success: true, channels: channels.getAll() });
});

app.delete('/api/admin/channels/:id', requireAdmin, (req, res) => {
    channels.delete(req.params.id);
    clearSubCache();
    res.json({ success: true, channels: channels.getAll() });
});

// Test whether Bot is an administrator in the channel
app.post('/api/admin/channels/test', requireAdmin, async (req, res) => {
    try {
        const { channel_username } = req.body;
        if (!channel_username) {
            return res.status(400).json({ error: 'Kanal username kiritilmadi' });
        }
        if (!bot || !bot.telegram) {
            return res.status(500).json({ error: 'Bot ishga tushmagan' });
        }

        const normalized = normalizeChannelData(channel_username, '').channel_username;
        const botInfo = await bot.telegram.getMe();
        const member = await bot.telegram.getChatMember(normalized, botInfo.id);

        const isAdmin = member && ['administrator', 'creator'].includes(member.status);
        res.json({
            success: true,
            is_admin: isAdmin,
            status: member.status,
            channel: normalized
        });
    } catch (err) {
        res.json({
            success: false,
            is_admin: false,
            error: err.response?.description || err.message
        });
    }
});

// Tasks Admin
app.get('/api/admin/tasks', requireAdmin, (req, res) => {
    res.json({ success: true, tasks: tasks.getAll() });
});

app.post('/api/admin/tasks', requireAdmin, (req, res) => {
    const { title, description, type, reward_altro, link, icon } = req.body;
    if (!title || !reward_altro || !link) {
        return res.status(400).json({ error: 'Sarlavha, mukofot va havola talab qilinadi' });
    }
    const id = tasks.create({ title, description, type, reward_altro, link, icon });
    res.json({ success: true, id, tasks: tasks.getAll() });
});

app.put('/api/admin/tasks/:id', requireAdmin, (req, res) => {
    const { title, description, reward_altro, link } = req.body;
    if (!title || !reward_altro || !link) {
        return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
    }
    tasks.update(req.params.id, title, description, Number(reward_altro), link);
    res.json({ success: true, tasks: tasks.getAll() });
});

app.delete('/api/admin/tasks/:id', requireAdmin, (req, res) => {
    tasks.delete(req.params.id);
    res.json({ success: true, tasks: tasks.getAll() });
});

// Admins Management
app.get('/api/admin/admins', requireAdmin, (req, res) => {
    res.json({ success: true, admins: admins.getAll() });
});

app.post('/api/admin/admins', requireAdmin, (req, res) => {
    const { new_admin_id, note } = req.body;
    if (!new_admin_id || isNaN(new_admin_id)) {
        return res.status(400).json({ error: 'Yaroqli Telegram ID kiriting' });
    }
    admins.add(parseInt(new_admin_id), note || '');
    res.json({ success: true, admins: admins.getAll() });
});

app.delete('/api/admin/admins/:id', requireAdmin, (req, res) => {
    const targetId = parseInt(req.params.id);
    const ownerId = process.env.OWNER_ID ? parseInt(process.env.OWNER_ID.trim()) : null;
    if (ownerId && targetId === ownerId) {
        return res.status(400).json({ error: 'Loyiha egasini (Owner) o\'chirib bo\'lmaydi!' });
    }
    admins.remove(targetId);
    res.json({ success: true, admins: admins.getAll() });
});

// Broadcast
app.post('/api/admin/broadcast', requireAdmin, async (req, res) => {
    const { message, photo_url } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Xabar matni kiritilmadi' });
    }

    const result = await broadcastMessage(message, photo_url);
    res.json({ success: true, result });
});

// Health check route for Render and Uptime monitoring
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        app: 'ALTRO SALE UC BOT',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 24/7 Bulletproof Keep-Alive: Ping itself every 3 minutes (180s) to keep Render awake 24/7 permanently
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://altro-sale-uc-bot.onrender.com';
if (WEBAPP_URL && WEBAPP_URL.startsWith('https://')) {
    const doPing = () => {
        const pingUrl = `${WEBAPP_URL}/health`;
        const req = https.get(pingUrl, { headers: { 'User-Agent': 'ALTRO-24-7-KeepAlive' }, timeout: 15000 }, (res) => {
            // Keep alive OK
        });
        req.on('error', (e) => {
            console.warn('⚠️ Keep-alive ping xatosi (30s dan keyin qayta uriniladi):', e.message);
            setTimeout(doPing, 30000);
        });
        req.on('timeout', () => {
            req.destroy();
        });
    };

    // Ping every 3 minutes
    setInterval(doPing, 3 * 60 * 1000);
    // Initial ping after 15 seconds
    setTimeout(doPing, 15000);
    console.log(`⏱️ 24/7 Bulletproof Keep-alive faollashtirildi (har 3 daqiqada): ${WEBAPP_URL}/health`);
}

// Global process safety against any unhandled error
process.on('uncaughtException', (err) => {
    console.error('⚠️ [Server] Uncaught Exception ushlandi:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ [Server] Unhandled Rejection ushlandi:', reason);
});

// Graceful container shutdown (Save database before Render stops the container)
process.once('SIGTERM', async () => {
    console.log('🛑 SIGTERM: Render to\'xtatilishidan oldin zaxira saqlanmoqda...');
    await backupDatabase(bot, OWNER_ID, 'shutdown (SIGTERM)');
    process.exit(0);
});

process.once('SIGINT', async () => {
    console.log('🛑 SIGINT: Server to\'xtatilishidan oldin zaxira saqlanmoqda...');
    await backupDatabase(bot, OWNER_ID, 'shutdown (SIGINT)');
    process.exit(0);
});

// Start Express Server with Cloud Backup Check
(async () => {
    // 1. Try restoring latest backup from Telegram if container is fresh
    try {
        await restoreDatabaseIfMissing(bot, OWNER_ID);
    } catch (err) {
        console.warn('Startup restore warning:', err.message);
    }

    // 2. Start server
    app.listen(PORT, () => {
        console.log(`🚀 ALTRO SALE UC BOT Serveri ishga tushdi: http://localhost:${PORT}`);
    });
})();
