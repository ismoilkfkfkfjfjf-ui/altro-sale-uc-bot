const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

// Ultra-fast SQLite pragmas for 30,000+ users
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY');

function initDb() {
    // 1. Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            pubg_id TEXT,
            pubg_name TEXT,
            altro_balance REAL DEFAULT 0,
            total_tapped REAL DEFAULT 0,
            total_uc_withdrawn REAL DEFAULT 0,
            multitap_level INTEGER DEFAULT 1,
            energy_limit_level INTEGER DEFAULT 1,
            recharge_speed_level INTEGER DEFAULT 1,
            current_energy INTEGER DEFAULT 1000,
            last_energy_update INTEGER DEFAULT 0,
            free_boosts_left INTEGER DEFAULT 3,
            last_boost_reset INTEGER DEFAULT 0,
            referrer_id INTEGER,
            referral_count INTEGER DEFAULT 0,
            last_checkin_date TEXT,
            checkin_streak INTEGER DEFAULT 0,
            created_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_users_balance ON users(altro_balance DESC);
        CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);
    `);

    // 2. Admins table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            telegram_id INTEGER PRIMARY KEY,
            role TEXT DEFAULT 'admin',
            note TEXT,
            added_at INTEGER
        );
    `);

    // 3. UC Exchange / Withdrawal Packages
    db.exec(`
        CREATE TABLE IF NOT EXISTS uc_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            altro_cost INTEGER NOT NULL,
            uc_amount INTEGER NOT NULL,
            title TEXT,
            badge TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER
        );
    `);

    // 4. Withdrawal Requests
    db.exec(`
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            pubg_id TEXT NOT NULL,
            pubg_name TEXT,
            altro_spent INTEGER NOT NULL,
            uc_amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            admin_note TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        );
        CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
    `);

    // 5. Mandatory Telegram Channels
    db.exec(`
        CREATE TABLE IF NOT EXISTS mandatory_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            channel_username TEXT NOT NULL,
            invite_link TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER
        );
    `);

    // 6. Optional Tasks / Shartlar
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL, -- 'youtube', 'telegram', 'social', 'custom'
            reward_altro INTEGER NOT NULL,
            link TEXT NOT NULL,
            icon TEXT DEFAULT 'fa-brands fa-youtube',
            is_active INTEGER DEFAULT 1,
            created_at INTEGER
        );
    `);

    // 7. User Completed Tasks
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_completed_tasks (
            user_id INTEGER,
            task_id INTEGER,
            completed_at INTEGER,
            PRIMARY KEY (user_id, task_id)
        );
    `);

    // 8. Global Settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // Insert initial default UC packages if table is empty (user requirements: 8000 -> 30 UC, 16000 -> 60 UC)
    const pkgCount = db.prepare('SELECT COUNT(*) as count FROM uc_packages').get().count;
    if (pkgCount === 0) {
        const insertPkg = db.prepare('INSERT INTO uc_packages (altro_cost, uc_amount, title, badge, created_at) VALUES (?, ?, ?, ?, ?)');
        const now = Date.now();
        insertPkg.run(8000, 30, '30 UC Paketi', 'Boshlang\'ich', now);
        insertPkg.run(16000, 60, '60 UC Paketi', 'Mashhur', now);
        insertPkg.run(80000, 325, '300 + 25 UC', 'Tejamkor', now);
        insertPkg.run(160000, 660, '600 + 60 UC (Royale Pass)', 'VIP', now);
    }

    // Insert default tasks if empty (user requirement: youtube obuna bosa 200 altro uc beradi)
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    if (taskCount === 0) {
        const insertTask = db.prepare('INSERT INTO tasks (title, description, type, reward_altro, link, icon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const now = Date.now();
        insertTask.run(
            'YouTube rasmiy obuna',
            'YouTube sahifamizga obuna bo\'ling va +200 Altro UC oling!',
            'youtube',
            200,
            'https://youtube.com',
            'fa-brands fa-youtube text-red-500',
            now
        );
        insertTask.run(
            'Do\'stingizni taklif qiling',
            'Har bir taklif qilingan do\'st uchun +500 Altro UC!',
            'referral',
            500,
            '#referral',
            'fa-solid fa-user-plus text-emerald-400',
            now
        );
    }

    // Mandatory channels table is empty by default; admin adds their own channels from Admin Panel.

    // Insert default settings
    const setSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    setSetting.run('bot_name', 'ALTRO SALE UC BOT');
    setSetting.run('channel_mandatory_active', '1');
    setSetting.run('referral_bonus', '500');
    setSetting.run('maintenance_mode', '0');
}

// User helper methods
const users = {
    getOrCreate: (telegram_id, data = {}) => {
        const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        const now = Date.now();
        if (existing) {
            // Calculate offline energy regeneration
            const maxEnergy = 1000 + (existing.energy_limit_level - 1) * 500;
            const rechargePerSec = 1 + (existing.recharge_speed_level - 1) * 1;
            const elapsedSec = Math.max(0, Math.floor((now - (existing.last_energy_update || now)) / 1000));
            const regeneratedEnergy = Math.min(maxEnergy, existing.current_energy + elapsedSec * rechargePerSec);
            
            // Check daily free boosts reset (every 24 hours)
            let freeBoosts = existing.free_boosts_left;
            let lastBoostReset = existing.last_boost_reset;
            if (now - lastBoostReset > 24 * 60 * 60 * 1000) {
                freeBoosts = 3;
                lastBoostReset = now;
            }

            db.prepare(`
                UPDATE users SET 
                    username = COALESCE(?, username),
                    first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    current_energy = ?,
                    last_energy_update = ?,
                    free_boosts_left = ?,
                    last_boost_reset = ?
                WHERE telegram_id = ?
            `).run(
                data.username || null,
                data.first_name || null,
                data.last_name || null,
                regeneratedEnergy,
                now,
                freeBoosts,
                lastBoostReset,
                telegram_id
            );

            return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        } else {
            // New user registration
            let referrer_id = null;
            if (data.referrer_id && parseInt(data.referrer_id) !== parseInt(telegram_id)) {
                const refUser = db.prepare('SELECT telegram_id FROM users WHERE telegram_id = ?').get(parseInt(data.referrer_id));
                if (refUser) {
                    referrer_id = refUser.telegram_id;
                    const refBonus = parseInt(settings.get('referral_bonus') || '500');
                    db.prepare('UPDATE users SET altro_balance = altro_balance + ?, referral_count = referral_count + 1 WHERE telegram_id = ?')
                        .run(refBonus, referrer_id);
                }
            }

            db.prepare(`
                INSERT INTO users (
                    telegram_id, username, first_name, last_name, 
                    altro_balance, current_energy, last_energy_update, 
                    free_boosts_left, last_boost_reset, referrer_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                telegram_id,
                data.username || '',
                data.first_name || '',
                data.last_name || '',
                0, // start with 0 altro
                1000,
                now,
                3,
                now,
                referrer_id,
                now
            );

            return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        }
    },

    getById: (telegram_id) => {
        return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
    },

    syncTaps: (telegram_id, tapsCount) => {
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return null;

        const now = Date.now();
        const maxEnergy = 1000 + (user.energy_limit_level - 1) * 500;
        const rechargePerSec = 1 + (user.recharge_speed_level - 1) * 1;
        const elapsedSec = Math.max(0, Math.floor((now - (user.last_energy_update || now)) / 1000));
        let energy = Math.min(maxEnergy, user.current_energy + elapsedSec * rechargePerSec);

        // Exactly deduct from energy whatever is earned (1:1 match)
        const energyUsed = Math.max(0, Math.min(tapsCount, energy));
        const altroEarned = energyUsed;

        energy = Math.max(0, energy - energyUsed);

        db.prepare(`
            UPDATE users SET 
                altro_balance = altro_balance + ?,
                total_tapped = total_tapped + ?,
                current_energy = ?,
                last_energy_update = ?
            WHERE telegram_id = ?
        `).run(altroEarned, energyUsed, energy, now, telegram_id);

        const updated = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return {
            altro_balance: updated.altro_balance,
            current_energy: updated.current_energy,
            max_energy: maxEnergy,
            taps_processed: energyUsed,
            altro_earned: altroEarned
        };
    },

    upgradeMultitap: (telegram_id) => {
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

        // Cost formula: level 1 -> 2: 200 Altro; level 2 -> 3: 500; level 3 -> 4: 1200; etc.
        const cost = Math.floor(200 * Math.pow(2.2, user.multitap_level - 1));
        if (user.altro_balance < cost) {
            return { success: false, message: `Mablag' yetarli emas! Kerak: ${cost.toLocaleString()} Altro UC` };
        }

        db.prepare(`
            UPDATE users SET 
                altro_balance = altro_balance - ?,
                multitap_level = multitap_level + 1
            WHERE telegram_id = ?
        `).run(cost, telegram_id);

        const updated = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return { success: true, user: updated, cost };
    },

    upgradeEnergyLimit: (telegram_id) => {
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

        const cost = Math.floor(250 * Math.pow(2.1, user.energy_limit_level - 1));
        if (user.altro_balance < cost) {
            return { success: false, message: `Mablag' yetarli emas! Kerak: ${cost.toLocaleString()} Altro UC` };
        }

        db.prepare(`
            UPDATE users SET 
                altro_balance = altro_balance - ?,
                energy_limit_level = energy_limit_level + 1
            WHERE telegram_id = ?
        `).run(cost, telegram_id);

        const updated = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return { success: true, user: updated, cost };
    },

    upgradeRechargeSpeed: (telegram_id) => {
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

        const cost = Math.floor(300 * Math.pow(2.3, user.recharge_speed_level - 1));
        if (user.altro_balance < cost) {
            return { success: false, message: `Mablag' yetarli emas! Kerak: ${cost.toLocaleString()} Altro UC` };
        }

        db.prepare(`
            UPDATE users SET 
                altro_balance = altro_balance - ?,
                recharge_speed_level = recharge_speed_level + 1
            WHERE telegram_id = ?
        `).run(cost, telegram_id);

        const updated = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return { success: true, user: updated, cost };
    },

    useFreeBoost: (telegram_id) => {
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

        if (user.free_boosts_left <= 0) {
            return { success: false, message: 'Bugungi bepul to\'ldirishlar tugadi! Ertaga yana urinib ko\'ring.' };
        }

        const maxEnergy = 1000 + (user.energy_limit_level - 1) * 500;
        const now = Date.now();

        db.prepare(`
            UPDATE users SET 
                current_energy = ?,
                free_boosts_left = free_boosts_left - 1,
                last_energy_update = ?
            WHERE telegram_id = ?
        `).run(maxEnergy, now, telegram_id);

        const updated = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return { success: true, user: updated };
    },

    updatePubgInfo: (telegram_id, pubg_id, pubg_name) => {
        db.prepare('UPDATE users SET pubg_id = ?, pubg_name = ? WHERE telegram_id = ?')
            .run(pubg_id, pubg_name, telegram_id);
        return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
    },

    getLeaderboard: (limit = 100) => {
        return db.prepare(`
            SELECT telegram_id, username, first_name, altro_balance, total_tapped, referral_count
            FROM users 
            ORDER BY altro_balance DESC 
            LIMIT ?
        `).all(limit);
    },

    getUserRank: (telegram_id) => {
        const user = db.prepare('SELECT altro_balance FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return null;
        const higher = db.prepare('SELECT COUNT(*) as count FROM users WHERE altro_balance > ?').get(user.altro_balance);
        return higher.count + 1;
    }
};

// Withdrawals helper
const withdrawals = {
    create: (telegram_id, package_id, pubg_id, pubg_name) => {
        const pkg = db.prepare('SELECT * FROM uc_packages WHERE id = ? AND is_active = 1').get(package_id);
        if (!pkg) return { success: false, message: 'Paket topilmadi' };

        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

        if (user.altro_balance < pkg.altro_cost) {
            return { 
                success: false, 
                message: `Balansda Altro UC yetarli emas! Sizda: ${Math.floor(user.altro_balance).toLocaleString()}, Kerak: ${pkg.altro_cost.toLocaleString()}` 
            };
        }

        const now = Date.now();

        const txn = db.transaction(() => {
            // Deduct altro balance
            db.prepare('UPDATE users SET altro_balance = altro_balance - ?, pubg_id = ?, pubg_name = ? WHERE telegram_id = ?')
                .run(pkg.altro_cost, pubg_id, pubg_name, telegram_id);

            // Record withdrawal
            const result = db.prepare(`
                INSERT INTO withdrawals (user_id, pubg_id, pubg_name, altro_spent, uc_amount, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
            `).run(telegram_id, pubg_id, pubg_name, pkg.altro_cost, pkg.uc_amount, now, now);

            return result.lastInsertRowid;
        });

        const id = txn();
        return { success: true, withdrawalId: id, uc: pkg.uc_amount, altro_spent: pkg.altro_cost };
    },

    getUserWithdrawals: (telegram_id) => {
        return db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(telegram_id);
    },

    getAll: (status = null) => {
        if (status) {
            return db.prepare(`
                SELECT w.*, u.username, u.first_name, u.last_name
                FROM withdrawals w
                JOIN users u ON w.user_id = u.telegram_id
                WHERE w.status = ?
                ORDER BY w.created_at DESC
            `).all(status);
        }
        return db.prepare(`
            SELECT w.*, u.username, u.first_name, u.last_name
            FROM withdrawals w
            JOIN users u ON w.user_id = u.telegram_id
            ORDER BY w.created_at DESC
        `).all();
    },

    updateStatus: (withdrawalId, status, note = '') => {
        const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
        if (!w) return { success: false, message: 'Ariza topilmadi' };

        const now = Date.now();

        const txn = db.transaction(() => {
            if (status === 'rejected' && w.status !== 'rejected') {
                // Refund Altro UC to user if rejected
                db.prepare('UPDATE users SET altro_balance = altro_balance + ? WHERE telegram_id = ?')
                    .run(w.altro_spent, w.user_id);
            } else if (status === 'approved' && w.status !== 'approved') {
                // Increase user total_uc_withdrawn
                db.prepare('UPDATE users SET total_uc_withdrawn = total_uc_withdrawn + ? WHERE telegram_id = ?')
                    .run(w.uc_amount, w.user_id);
            }

            db.prepare('UPDATE withdrawals SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?')
                .run(status, note, now, withdrawalId);
        });

        txn();
        return { success: true, withdrawal: db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId) };
    }
};

// Admin management helper
const admins = {
    isAdmin: (telegram_id) => {
        if (!telegram_id) return false;
        const res = db.prepare('SELECT * FROM admins WHERE telegram_id = ?').get(telegram_id);
        return !!res;
    },

    isOwner: (telegram_id) => {
        if (!telegram_id) return false;
        const res = db.prepare('SELECT * FROM admins WHERE telegram_id = ? AND role = "owner"').get(telegram_id);
        return !!res;
    },

    add: (telegram_id, note = '', role = 'admin') => {
        db.prepare("INSERT OR REPLACE INTO admins (telegram_id, role, note, added_at) VALUES (?, ?, ?, ?)")
            .run(telegram_id, role, note, Date.now());
        return true;
    },

    remove: (telegram_id) => {
        db.prepare('DELETE FROM admins WHERE telegram_id = ?').run(telegram_id);
        return true;
    },

    getAll: () => {
        return db.prepare('SELECT * FROM admins ORDER BY added_at DESC').all();
    }
};

// Settings helper
const settings = {
    get: (key) => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    },
    set: (key, value) => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    },
    getAll: () => {
        return db.prepare('SELECT * FROM settings').all();
    }
};

// Tasks helper
const tasks = {
    getAll: (user_id = null) => {
        const allTasks = db.prepare('SELECT * FROM tasks WHERE is_active = 1 ORDER BY id ASC').all();
        if (!user_id) return allTasks;

        const completed = new Set(
            db.prepare('SELECT task_id FROM user_completed_tasks WHERE user_id = ?')
                .all(user_id)
                .map(r => r.task_id)
        );

        return allTasks.map(t => ({
            ...t,
            is_completed: completed.has(t.id)
        }));
    },

    complete: (user_id, task_id) => {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND is_active = 1').get(task_id);
        if (!task) return { success: false, message: 'Vazifa topilmadi' };

        const already = db.prepare('SELECT * FROM user_completed_tasks WHERE user_id = ? AND task_id = ?').get(user_id, task_id);
        if (already) return { success: false, message: 'Bu vazifa allaqachon bajarilgan' };

        const txn = db.transaction(() => {
            db.prepare('INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (?, ?, ?)')
                .run(user_id, task_id, Date.now());
            db.prepare('UPDATE users SET altro_balance = altro_balance + ? WHERE telegram_id = ?')
                .run(task.reward_altro, user_id);
        });

        txn();
        const updatedUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(user_id);
        return { success: true, reward: task.reward_altro, newBalance: updatedUser.altro_balance };
    },

    create: (data) => {
        const result = db.prepare(`
            INSERT INTO tasks (title, description, type, reward_altro, link, icon, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).run(data.title, data.description || '', data.type || 'custom', data.reward_altro, data.link, data.icon || 'fa-solid fa-gift', Date.now());
        return result.lastInsertRowid;
    },

    delete: (task_id) => {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(task_id);
        db.prepare('DELETE FROM user_completed_tasks WHERE task_id = ?').run(task_id);
        return true;
    },

    update: (id, title, description, reward_altro, link) => {
        db.prepare(`
            UPDATE tasks SET title = ?, description = ?, reward_altro = ?, link = ? WHERE id = ?
        `).run(title, description, reward_altro, link, id);
        return true;
    }
};

// Mandatory channels helper
const channels = {
    getAll: () => {
        return db.prepare('SELECT * FROM mandatory_channels WHERE is_active = 1').all();
    },

    add: (title, channel_username, invite_link) => {
        const res = db.prepare(`
            INSERT INTO mandatory_channels (title, channel_username, invite_link, is_active, created_at)
            VALUES (?, ?, ?, 1, ?)
        `).run(title, channel_username, invite_link, Date.now());
        return res.lastInsertRowid;
    },

    update: (id, title, channel_username, invite_link) => {
        db.prepare(`
            UPDATE mandatory_channels SET title = ?, channel_username = ?, invite_link = ? WHERE id = ?
        `).run(title, channel_username, invite_link, id);
        return true;
    },

    delete: (id) => {
        db.prepare('DELETE FROM mandatory_channels WHERE id = ?').run(id);
        return true;
    }
};

// UC Packages helper
const packages = {
    getAll: () => {
        return db.prepare('SELECT * FROM uc_packages WHERE is_active = 1 ORDER BY altro_cost ASC').all();
    },

    add: (altro_cost, uc_amount, title = '', badge = '') => {
        const res = db.prepare(`
            INSERT INTO uc_packages (altro_cost, uc_amount, title, badge, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
        `).run(altro_cost, uc_amount, title, badge, Date.now());
        return res.lastInsertRowid;
    },

    update: (id, altro_cost, uc_amount, title = '', badge = '') => {
        db.prepare(`
            UPDATE uc_packages SET altro_cost = ?, uc_amount = ?, title = ?, badge = ? WHERE id = ?
        `).run(altro_cost, uc_amount, title, badge, id);
        return true;
    },

    delete: (id) => {
        db.prepare('DELETE FROM uc_packages WHERE id = ?').run(id);
        return true;
    }
};

// Initialize DB schema on load
initDb();

module.exports = {
    db,
    users,
    withdrawals,
    admins,
    settings,
    tasks,
    channels,
    packages
};
