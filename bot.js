const { Telegraf, Markup } = require('telegraf');
const { users, channels, admins, settings } = require('./database');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:3000';

let bot = null;

if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    bot = new Telegraf(BOT_TOKEN);
} else {
    console.warn('⚠️ BOT_TOKEN sozlanmagan! Bot test rejimida ishlaydi yoki .env faylida BOT_TOKEN kiriting.');
}

// Check if user is member of all mandatory channels
async function checkUserSubscription(ctx, userId) {
    const isMandatoryActive = settings.get('channel_mandatory_active') !== '0';
    if (!isMandatoryActive) return { allSubscribed: true, missing: [] };

    const activeChannels = channels.getAll();
    if (activeChannels.length === 0) return { allSubscribed: true, missing: [] };

    const missing = [];
    for (const ch of activeChannels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.channel_username, userId);
            if (['left', 'kicked'].includes(member.status)) {
                missing.push(ch);
            }
        } catch (err) {
            // If bot is not admin in channel, or channel username is invalid
            console.warn(`[Channel Check Warning] Kanalni tekshirib bo'lmadi (${ch.channel_username}):`, err.message);
            // We do not block users if the bot itself hasn't been added to the channel yet
        }
    }

    return {
        allSubscribed: missing.length === 0,
        missing
    };
}

// Helper to check if URL is localhost/HTTP (Telegram disallows localhost in inline buttons)
function isLocalhost(url) {
    return !url || url.includes('localhost') || url.includes('127.0.0.1');
}

function createGameButton(text, url) {
    if (url && url.startsWith('https://')) {
        return Markup.button.webApp(text, url);
    }
    if (isLocalhost(url)) {
        return Markup.button.callback('⚡ O\'YINNI BOSHLASH ⚡', 'localhost_info');
    }
    return Markup.button.url(text, url);
}

function createAdminButton(text, url) {
    if (url && url.startsWith('https://')) {
        return Markup.button.webApp(text, url);
    }
    if (isLocalhost(url)) {
        return Markup.button.callback(text, 'admin_localhost_info');
    }
    return Markup.button.url(text, url);
}

// Bot logic
if (bot) {
    // Catch errors gracefully to prevent crashing
    bot.catch((err, ctx) => {
        console.error(`Telegram Bot xatosi (${ctx?.updateType || 'unknown'}):`, err.message || err);
    });
    // Middleware to record/update user info
    bot.use(async (ctx, next) => {
        if (ctx.from) {
            users.getOrCreate(ctx.from.id, {
                username: ctx.from.username,
                first_name: ctx.from.first_name,
                last_name: ctx.from.last_name
            });
        }
        return next();
    });

    // Start command
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const startPayload = ctx.startPayload || '';
        let referrerId = null;

        if (startPayload.startsWith('ref_')) {
            referrerId = startPayload.replace('ref_', '');
        }

        // Register with referrer
        const user = users.getOrCreate(userId, {
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            referrer_id: referrerId
        });

        // Check mandatory subscription
        const subCheck = await checkUserSubscription(ctx, userId);

        if (!subCheck.allSubscribed) {
            const buttons = subCheck.missing.map(ch => Markup.button.url(`📢 ${ch.title}`, ch.invite_link));
            buttons.push(Markup.button.callback('✅ A\'zo bo\'ldim (Tekshirish)', 'check_sub'));

            return ctx.reply(
                `👋 **Assalomu alaykum, ${ctx.from.first_name}!**\n\n` +
                `🎮 **ALTRO SALE UC BOT** botidan foydalanish va bepul **PUBG Mobile UC** yutib olish uchun quyidagi rasmiy kanallarimizga obuna bo'ling:`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard(buttons, { columns: 1 })
                }
            );
        }

        // Subscribed -> Show Web App Launch Button
        sendWelcomeMessage(ctx);
    });

    // Check subscription callback
    bot.action('check_sub', async (ctx) => {
        const userId = ctx.from.id;
        const subCheck = await checkUserSubscription(ctx, userId);

        if (!subCheck.allSubscribed) {
            return ctx.answerCbQuery('⚠️ Siz hali hamma kanallarga a\'zo bo\'lmadingiz! Iltimos, obuna bo\'ling.', { show_alert: true });
        }

        await ctx.answerCbQuery('🎉 Obuna tasdiqlandi!');
        try {
            await ctx.deleteMessage();
        } catch (e) {}
        sendWelcomeMessage(ctx);
    });

    // Referral link button
    bot.action('get_ref_link', async (ctx) => {
        const botInfo = await bot.telegram.getMe();
        const refLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;
        const refBonus = settings.get('referral_bonus') || '500';

        await ctx.reply(
            `👥 **Do'stlaringizni taklif qiling va Altro UC ishlang!**\n\n` +
            `🎁 Har bir taklif qilgan do'stingiz uchun sizga **+${refBonus} Altro UC** beriladi!\n\n` +
            `🔗 **Sizning taklif havolangiz:**\n\`${refLink}\``,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.url('📲 Do\'stlarga ulashish', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('🎮 PUBG Mobile uchun bepul UC ishlaymiz! ALTRO SALE UC BOT ga kiring:')}`),
                    Markup.button.callback('⬅️ Orqaga', 'back_to_menu')
                ])
            }
        );
        await ctx.answerCbQuery();
    });

    // Back to menu
    bot.action('back_to_menu', async (ctx) => {
        await ctx.answerCbQuery();
        try {
            await ctx.deleteMessage();
        } catch (e) {}
        sendWelcomeMessage(ctx);
    });

    // Info callback
    bot.action('help_info', async (ctx) => {
        await ctx.reply(
            `📖 **ALTRO SALE UC BOT Qo'llanmasi:**\n\n` +
            `1️⃣ **Bosing va yig'ing:** Ekrandagi UC kartasini bosing va Altro UC ishlang!\n` +
            `2️⃣ **Kuchaytiring:** Multitap, Energiya sig'imi va tiklanish tezligini oshirib, ko'proq ishlang.\n` +
            `3️⃣ **Vazifalar:** YouTube kanaliga obuna bo'lib va do'stlarni chaqirib bonus oling.\n` +
            `4️⃣ **PUBG UC Yechish:** 8.000 Altro = 30 UC, 16.000 Altro = 60 UC va undan yuqori!\n` +
            `5️⃣ **Reyting:** Eng faol o'yinchilar qatoridan joy oling va sovg'alarga ega bo'ling!\n\n` +
            `🆘 **24/7 Qo'llab-quvvatlash:** @ALTRO_ADMN`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('💬 24/7 Support Lichka', 'https://t.me/ALTRO_ADMN')],
                    [Markup.button.callback('⬅️ Orqaga', 'back_to_menu')]
                ])
            }
        );
        await ctx.answerCbQuery();
    });

    // Support command
    bot.command(['support', 'yordam', 'aloqa', 'help'], async (ctx) => {
        await ctx.reply(
            `🆘 **24/7 QO'LLAB-QUVVATLASH XIZMATI (SUPPORT)**\n\n` +
            `Savollaringiz, takliflaringiz yoki UC yechish bilan bog'liq har qanday masalada to'g'ridan-to'g'ri admin bilan bog'lanishingiz mumkin:\n\n` +
            `👤 **Admin lichka:** @ALTRO_ADMN\n` +
            `⏰ **Rejim:** 24/7 tun-u kun doimiy aloqada!\n\n` +
            `Pastdagi tugmani bosib darhol yozishingiz mumkin 👇`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.url('💬 24/7 Admin Lichkasiga Yozish', 'https://t.me/ALTRO_ADMN')
                ])
            }
        );
    });

    // Localhost info callback
    bot.action('localhost_info', async (ctx) => {
        const userId = ctx.from.id;
        await ctx.reply(
            `💻 **O'yinni ochish (Lokal rejim):**\n\n` +
            `Hozirda server lokal kompyuterda ishlayapti. O'yinga kirish uchun kompyuteringiz brauzerida quyidagi havolani bosing:\n\n` +
            `👉 http://localhost:3000?tg_id=${userId}\n\n` +
            `*(Telegram ichida to'g'ridan-to'g'ri Web App bo'lib ochilishi uchun serverni Render.com ga yoki ngrok/localtunnel HTTPS manziliga ulash kerak).*`
        );
        await ctx.answerCbQuery();
    });

    bot.action('admin_localhost_info', async (ctx) => {
        const userId = ctx.from.id;
        await ctx.reply(
            `👑 **Admin Panelni Ochish:**\n\n` +
            `Kompyuteringiz brauzerida oching:\n` +
            `👉 http://localhost:3000/admin.html?admin_id=${userId}`
        );
        await ctx.answerCbQuery();
    });

    // Admin command
    bot.command('admin', async (ctx) => {
        const userId = ctx.from.id;
        if (!admins.isAdmin(userId)) {
            return ctx.reply('⛔ Kechirasiz, siz admin emassiz.');
        }

        const appUrl = `${WEBAPP_URL}/admin.html?admin_id=${userId}`;
        if (appUrl.startsWith('https://')) {
            await ctx.reply(
                `👑 **ALTRO SALE UC BOT Admin Paneli**\n\n` +
                `Admin panelni ochish uchun quyidagi tugmani bosing:`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        Markup.button.webApp('⚙️ Admin Panelni Ochish', appUrl),
                        Markup.button.url('🌐 Brauzerda ochish', appUrl)
                    ])
                }
            );
        } else {
            await ctx.reply(
                `👑 **ALTRO SALE UC BOT Admin Paneli**\n\n` +
                `Boshqaruv paneliga kirish uchun brauzeringizda quyidagi manzilni oching:\n\n` +
                `👉 ${appUrl}`
            );
        }
    });

    // Launch bot
    bot.launch()
        .then(() => console.log('🤖 Telegram Bot muvaffaqiyatli ishga tushdi!'))
        .catch(err => console.error('Telegram Bot xatoligi:', err.message));

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

function sendWelcomeMessage(ctx) {
    const userId = ctx.from.id;
    const isUserAdmin = admins.isAdmin(userId);
    const appUrl = `${WEBAPP_URL}?tg_id=${userId}`;
    const adminAppUrl = `${WEBAPP_URL}/admin.html?admin_id=${userId}`;

    // Faqat bitta asosiy Web App tugmasi: "UC ISHLANG"
    const startBtn = createGameButton('🎮 UC ISHLANG 🎮', appUrl);

    const keyboard = [
        [startBtn]
    ];

    if (isUserAdmin) {
        keyboard.push([createAdminButton('👑 Admin Panel PRO', adminAppUrl)]);
    }

    ctx.reply(
        `🏆 **ALTRO SALE UC BOT — PUBG MOBILE TAP-TO-EARN**\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 **Assalomu alaykum, ${ctx.from.first_name || 'Jangchi'}!**\n\n` +
        `🔥 **ALTRO SALE UC BOT** ga xush kelibsiz!\n\n` +
        `💰 **UC KARTASINI BOSING VA BEPUL PUBG UC YIG'ING!**\n\n` +
        `🟡 **8,000 Altro UC** ➔ **30 PUBG UC**\n` +
        `🟡 **16,000 Altro UC** ➔ **60 PUBG UC**\n` +
        `🟡 **80,000 Altro UC** ➔ **300+25 PUBG UC**\n` +
        `🟡 **160,000 Altro UC** ➔ **Royale Pass (660 UC)**\n\n` +
        `⚡ *Barcha bo'limlar (vazifalar, do'stlarni chaqirish, reyting, 24/7 yordam va UC yechish) to'liq Web App ichida joylashgan!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 *O'yinni ochish uchun pastdagi tugmani bosing:*`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(keyboard)
        }
    );
}

// Function to send withdrawal notifications to user
async function notifyWithdrawalUpdate(userId, ucAmount, pubgId, status, note = '') {
    if (!bot) return;
    try {
        if (status === 'approved') {
            await bot.telegram.sendMessage(
                userId,
                `🎉 **TABRIKLAYMIZ! UC YECHIB OLINDI!**\n\n` +
                `✅ Siz so'ragan **${ucAmount} PUBG UC** sizning hisobingizga muvaffaqiyatli o'tkazib berildi!\n` +
                `🆔 **PUBG ID:** \`${pubgId}\`\n\n` +
                `Do'stlaringizga ham ulashing va yanada ko'proq UC yig'ing! 🚀`,
                { parse_mode: 'Markdown' }
            );
        } else if (status === 'rejected') {
            await bot.telegram.sendMessage(
                userId,
                `❌ **UC YECHISH ARIZASI RAD ETILDI**\n\n` +
                `Arizangiz: **${ucAmount} UC** (PUBG ID: \`${pubgId}\`)\n` +
                (note ? `💬 **Sabab:** ${note}\n\n` : '\n') +
                `🔄 Altro UC balansingiz qaytarildi. Iltimos PUBG ID to'g'riligini tekshiring va qayta ariza bering.\n\n` +
                `🆘 Savollar bo'lsa 24/7 adminga yozing: @ALTRO_ADMN`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('💬 24/7 Support Lichka', 'https://t.me/ALTRO_ADMN')]
                    ])
                }
            );
        }
    } catch (e) {
        console.warn(`User ${userId} ga xabar yuborishda xatolik:`, e.message);
    }
}

// Broadcast message to all users
async function broadcastMessage(text, photoUrl = null) {
    if (!bot) return { sent: 0, failed: 0 };
    const allUsers = users.getLeaderboard(100000); // get all users
    let sent = 0;
    let failed = 0;

    for (const u of allUsers) {
        try {
            if (photoUrl) {
                await bot.telegram.sendPhoto(u.telegram_id, photoUrl, { caption: text, parse_mode: 'Markdown' });
            } else {
                await bot.telegram.sendMessage(u.telegram_id, text, { parse_mode: 'Markdown' });
            }
            sent++;
            // small delay to prevent telegram flood limits
            await new Promise(r => setTimeout(r, 40));
        } catch (err) {
            failed++;
        }
    }
    return { sent, failed };
}

// Notify all admins about a new withdrawal request
async function notifyAdminsNewWithdrawal(withdrawal) {
    if (!bot) return;
    const adminList = admins.getAll();
    const message = `🔔 **YANGI UC YECHISH ARIZASI!**\n\n` +
        `👤 **Foydalanuvchi:** ID \`${withdrawal.user_id}\`\n` +
        `🆔 **PUBG ID:** \`${withdrawal.pubg_id}\`\n` +
        `🎮 **PUBG Nomi:** ${withdrawal.pubg_name || 'Kiritilmagan'}\n` +
        `💎 **Miqdori:** **${withdrawal.uc_amount} PUBG UC**\n` +
        `💰 **Sarflangan:** ${Number(withdrawal.altro_spent || 0).toLocaleString()} Altro UC\n\n` +
        `⚡ Tasdiqlash uchun admin panelga kiring!`;

    for (const adm of adminList) {
        try {
            await bot.telegram.sendMessage(adm.telegram_id, message, { parse_mode: 'Markdown' });
        } catch (e) {
            // Admin hasn't started the bot yet or blocked
        }
    }
}

module.exports = {
    bot,
    checkUserSubscription,
    notifyWithdrawalUpdate,
    notifyAdminsNewWithdrawal,
    broadcastMessage
};
