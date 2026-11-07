// ALTRO UC BIT — Main App Controller
window.appState = {
    user: null,
    packages: [],
    tasks: [],
    mandatory_channels: [],
    is_admin: false,
    settings: {},
    activeTab: 'tap'
};

class MainApp {
    async init() {
        // Expand Telegram WebApp if present
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            window.Telegram.WebApp.enableClosingConfirmation();
        }

        // Get Telegram User or Fallback for browser preview
        const tgUser = this.resolveTelegramUser();

        try {
            const res = await fetch('/api/user/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tgUser)
            });

            const data = await res.json();
            if (!data.success) {
                alert('Tizimga kirishda xatolik: ' + data.error);
                return;
            }

            window.appState = {
                ...window.appState,
                user: data.user,
                packages: data.packages,
                tasks: data.tasks,
                mandatory_channels: data.mandatory_channels,
                is_admin: data.is_admin,
                settings: data.settings,
                is_subscribed: data.is_subscribed
            };

            // Setup Sound toggle
            this.setupSoundButton();

            // Setup Admin Button if admin
            if (data.is_admin) {
                const adminBtn = document.getElementById('admin-quick-btn');
                if (adminBtn) {
                    adminBtn.classList.remove('hidden');
                    adminBtn.href = `/admin.html?admin_id=${data.user.telegram_id}`;
                }
            }

            // Initialize Game & modules
            window.gameEngine.init();
            this.updateUI();

            // 100% strict channel subscription check: block Web App if not subscribed
            if (data.is_subscribed === false && data.missing_channels && data.missing_channels.length > 0) {
                this.showMandatoryModal(data.missing_channels);
            }

        } catch (err) {
            console.error('App init error:', err);
        }
    }

    resolveTelegramUser() {
        const urlParams = new URLSearchParams(window.location.search);
        const queryTgId = urlParams.get('tg_id');
        const refId = urlParams.get('ref') || urlParams.get('start');

        // 1. From Telegram WebApp SDK
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const u = window.Telegram.WebApp.initDataUnsafe.user;
            return {
                telegram_id: u.id,
                username: u.username || '',
                first_name: u.first_name || '',
                last_name: u.last_name || '',
                referrer_id: refId
            };
        }

        // 2. From URL params (e.g. testing)
        if (queryTgId) {
            return {
                telegram_id: parseInt(queryTgId),
                username: 'User_' + queryTgId,
                first_name: 'Player',
                last_name: queryTgId,
                referrer_id: refId
            };
        }

        // 3. From LocalStorage (Persistent test session for PC / Browser)
        let savedId = localStorage.getItem('altro_local_tg_id');
        if (!savedId) {
            savedId = String(Math.floor(100000000 + Math.random() * 900000000));
            localStorage.setItem('altro_local_tg_id', savedId);
        }

        return {
            telegram_id: parseInt(savedId),
            username: 'test_player',
            first_name: 'PUBG',
            last_name: 'Warrior',
            referrer_id: refId
        };
    }

    showMandatoryModal(channelsList) {
        const modal = document.getElementById('mandatory-modal');
        const list = document.getElementById('mandatory-channels-list');
        const errEl = document.getElementById('mandatory-error-msg');
        if (!modal || !list) return;

        if (errEl) errEl.classList.add('hidden');

        list.innerHTML = channelsList.map(ch => `
            <a href="${ch.invite_link}" target="_blank" class="glass-panel p-3.5 flex items-center justify-between border border-amber-400/40 hover:border-amber-300 transition-all bg-slate-900/90 rounded-2xl">
                <div class="flex items-center gap-3 overflow-hidden mr-2">
                    <div class="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center text-xl flex-shrink-0">
                        <i class="fa-brands fa-telegram"></i>
                    </div>
                    <div class="text-left overflow-hidden">
                        <div class="text-xs font-black text-white truncate">${ch.title}</div>
                        <div class="text-[10px] text-yellow-400 font-mono truncate">${ch.channel_username}</div>
                    </div>
                </div>
                <span class="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md flex items-center gap-1.5 flex-shrink-0">
                    <span>A'zo bo'lish</span> <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </span>
            </a>
        `).join('');

        modal.classList.remove('hidden');
    }

    async confirmSubscription() {
        const btn = document.getElementById('btn-check-mandatory-sub');
        const btnText = document.getElementById('btn-check-sub-text');
        const errEl = document.getElementById('mandatory-error-msg');

        if (!window.appState.user) return;

        if (btn) btn.disabled = true;
        if (btnText) btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tekshirilmoqda...';

        try {
            const res = await fetch('/api/user/check-sub', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id
                })
            });

            const data = await res.json();
            if (data.is_subscribed) {
                window.appState.is_subscribed = true;
                const modal = document.getElementById('mandatory-modal');
                if (modal) modal.classList.add('hidden');

                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
                alert('🎉 Obunangiz muvaffaqiyatli tasdiqlandi! O\'yinga xush kelibsiz!');
            } else {
                const missingTitles = (data.missing_channels || []).map(c => `"${c.title}"`).join(', ');
                if (errEl) {
                    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> Siz hali quyidagi kanal(lar)ga a'zo bo'lmadingiz:<br><b class="text-white">${missingTitles || 'Barcha kanallar'}</b>.<br><span class="text-yellow-300">Iltimos, avval obuna bo'ling va keyin qayta tekshiring!</span>`;
                    errEl.classList.remove('hidden');
                }
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                }
                if (data.missing_channels && data.missing_channels.length > 0) {
                    this.showMandatoryModal(data.missing_channels);
                }
            }
        } catch (err) {
            if (errEl) {
                errEl.textContent = '⚠️ Tarmoq xatoligi. Qayta urinib ko\'ring.';
                errEl.classList.remove('hidden');
            }
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> A\'zo bo\'ldim (Tekshirish)';
        }
    }

    setupSoundButton() {
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (!soundBtn) return;

        const updateIcon = () => {
            const isMuted = window.soundController.isMuted();
            soundBtn.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark text-slate-400"></i>' : '<i class="fa-solid fa-volume-high text-amber-400"></i>';
        };

        soundBtn.addEventListener('click', () => {
            window.soundController.toggleMute();
            updateIcon();
        });

        updateIcon();
    }

    switchTab(tabId) {
        window.appState.activeTab = tabId;

        // Hide all panes
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        // Show target pane
        const targetPane = document.getElementById(`tab-${tabId}`);
        const targetNav = document.getElementById(`nav-${tabId}`);

        if (targetPane) targetPane.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        // Trigger tab specific loads
        if (tabId === 'withdraw') {
            window.withdrawManager.renderPackages();
        } else if (tabId === 'tasks') {
            window.tasksManager.renderTasks();
            this.renderReferralLink();
        } else if (tabId === 'leaderboard') {
            window.leaderboardManager.loadLeaderboard();
        } else if (tabId === 'profile') {
            window.profileManager.loadProfile();
        } else if (tabId === 'boost') {
            this.renderBoosts();
        }

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    }

    updateUI() {
        const u = window.appState.user;
        if (!u) return;

        // Header balance & main balance
        const balanceEls = document.querySelectorAll('.user-balance');
        const formattedBalance = Math.floor(u.altro_balance).toLocaleString();
        balanceEls.forEach(el => { el.textContent = formattedBalance; });

        // Energy Bar
        this.updateEnergyUI();

        // Level / League calculation
        this.updateLeagueUI();

        // Multitap earn display
        const earnPerTapEl = document.getElementById('earn-per-tap');
        if (earnPerTapEl) {
            earnPerTapEl.textContent = `+${u.multitap_level || 1}`;
        }
    }

    updateEnergyUI() {
        const u = window.appState.user;
        if (!u) return;

        const maxEnergy = u.max_energy || 1000;
        const currentEnergy = Math.floor(u.current_energy);
        const percent = Math.min(100, Math.max(0, (currentEnergy / maxEnergy) * 100));

        const energyText = document.getElementById('energy-text');
        const energyBar = document.getElementById('energy-bar');

        if (energyText) energyText.textContent = `${currentEnergy} / ${maxEnergy}`;
        if (energyBar) energyBar.style.width = `${percent}%`;
    }

    updateLeagueUI() {
        const u = window.appState.user;
        if (!u) return;

        const totalEarned = (u.total_tapped || 0) * (u.multitap_level || 1) + u.altro_balance;
        let league = { name: 'Bronze', badge: 'badge-diamond', icon: 'fa-shield-halved' };

        if (totalEarned >= 1000000) {
            league = { name: 'Conqueror', badge: 'badge-conqueror', icon: 'fa-crown text-red-500' };
        } else if (totalEarned >= 250000) {
            league = { name: 'Ace', badge: 'badge-ace', icon: 'fa-star text-amber-400' };
        } else if (totalEarned >= 50000) {
            league = { name: 'Crown', badge: 'badge-crown', icon: 'fa-chess-queen text-purple-400' };
        } else if (totalEarned >= 10000) {
            league = { name: 'Diamond', badge: 'badge-diamond', icon: 'fa-gem text-cyan-400' };
        }

        const leagueBadgeEl = document.getElementById('league-badge');
        if (leagueBadgeEl) {
            leagueBadgeEl.textContent = league.name;
        }
    }

    renderBoosts() {
        const u = window.appState.user;
        if (!u) return;

        // Multitap cost
        const multitapCost = Math.floor(200 * Math.pow(2.2, (u.multitap_level || 1) - 1));
        const multitapLvlEl = document.getElementById('boost-multitap-lvl');
        const multitapCostEl = document.getElementById('boost-multitap-cost');
        if (multitapLvlEl) multitapLvlEl.textContent = `Daraja ${u.multitap_level}`;
        if (multitapCostEl) multitapCostEl.textContent = `${multitapCost.toLocaleString()} Altro UC`;

        // Energy Limit cost
        const energyCost = Math.floor(250 * Math.pow(2.1, (u.energy_limit_level || 1) - 1));
        const energyLvlEl = document.getElementById('boost-energy-lvl');
        const energyCostEl = document.getElementById('boost-energy-cost');
        if (energyLvlEl) energyLvlEl.textContent = `Daraja ${u.energy_limit_level}`;
        if (energyCostEl) energyCostEl.textContent = `${energyCost.toLocaleString()} Altro UC`;

        // Recharge Speed cost
        const rechargeCost = Math.floor(300 * Math.pow(2.3, (u.recharge_speed_level || 1) - 1));
        const rechargeLvlEl = document.getElementById('boost-recharge-lvl');
        const rechargeCostEl = document.getElementById('boost-recharge-cost');
        if (rechargeLvlEl) rechargeLvlEl.textContent = `Daraja ${u.recharge_speed_level}`;
        if (rechargeCostEl) rechargeCostEl.textContent = `${rechargeCost.toLocaleString()} Altro UC`;

        // Free Turbo Boosts
        const freeBoostsEl = document.getElementById('boost-free-count');
        if (freeBoostsEl) freeBoostsEl.textContent = `${u.free_boosts_left || 0}/3 qoldi`;
    }

    async upgrade(type) {
        try {
            const res = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    type
                })
            });

            const data = await res.json();
            if (data.success) {
                if (window.soundController) window.soundController.playUpgrade();
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }

                window.appState.user = data.user;
                this.updateUI();
                this.renderBoosts();
                alert('Kuchaytirish muvaffaqiyatli amalga oshirildi! 🚀');
            } else {
                alert(data.message || 'Xatolik yuz berdi');
            }
        } catch (e) {
            alert('Aloqa xatoligi!');
        }
    }

    renderReferralLink() {
        const u = window.appState.user;
        if (!u) return;

        const botUser = window.appState.settings?.bot_username || 'altrosaleucbot';
        const refLink = `https://t.me/${botUser}?start=ref_${u.telegram_id}`;
        const refInput = document.getElementById('referral-link-input');
        if (refInput) refInput.value = refLink;
    }

    copyReferralLink() {
        const refInput = document.getElementById('referral-link-input');
        if (!refInput) return;

        refInput.select();
        navigator.clipboard.writeText(refInput.value);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert('Taklif havolasi nusxalandi! Do\'stlaringizga yuboring 🎁');
    }

    shareReferralTelegram() {
        const u = window.appState.user;
        const botUser = window.appState.settings?.bot_username || 'altrosaleucbot';
        const refLink = `https://t.me/${botUser}?start=ref_${u.telegram_id}`;
        const shareText = encodeURIComponent('🎮 PUBG Mobile uchun bepul UC ishlaymiz! ALTRO SALE UC BOT ga kiring va bonus oling:');
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}`;

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(telegramUrl);
        } else {
            window.open(telegramUrl, '_blank');
        }
    }
}

window.app = new MainApp();
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
