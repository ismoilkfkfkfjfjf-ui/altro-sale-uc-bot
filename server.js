const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { db, users, withdrawals, admins, settings, tasks, channels, packages } = require('./database');
const { bot, notifyWithdrawalUpdate, notifyAdminsNewWithdrawal, broadcastMessage } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Process Taps (Batch sync)
app.post('/api/user/tap', (req, res) => {
    try {
        const { telegram_id, taps } = req.body;
        if (!telegram_id || !taps || taps <= 0) {
            return res.status(400).json({ error: 'Invalid parameters' });
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
app.post('/api/user/upgrade', (req, res) => {
    try {
        const { telegram_id, type } = req.body;
        if (!telegram_id || !type) {
            return res.status(400).json({ error: 'telegram_id and type are required' });
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
app.post('/api/withdraw/request', (req, res) => {
    try {
        const { telegram_id, package_id, pubg_id, pubg_name } = req.body;
        if (!telegram_id || !package_id || !pubg_id) {
            return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
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
    if (!title || !channel_username || !invite_link) {
        return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
    }
    const id = channels.add(title, channel_username, invite_link);
    res.json({ success: true, id, channels: channels.getAll() });
});

app.put('/api/admin/channels/:id', requireAdmin, (req, res) => {
    const { title, channel_username, invite_link } = req.body;
    if (!title || !channel_username || !invite_link) {
        return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
    }
    channels.update(req.params.id, title, channel_username, invite_link);
    res.json({ success: true, channels: channels.getAll() });
});

app.delete('/api/admin/channels/:id', requireAdmin, (req, res) => {
    channels.delete(req.params.id);
    res.json({ success: true, channels: channels.getAll() });
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

// Start Express Server
app.listen(PORT, () => {
    console.log(`🚀 ALTRO SALE UC BOT Serveri ishga tushdi: http://localhost:${PORT}`);
});
