// ALTRO UC BIT — Profile & History Manager
class ProfileManager {
    async loadProfile() {
        const u = window.appState.user;
        if (!u) return;

        // Populate Profile Info
        const nameEl = document.getElementById('profile-name');
        const tgIdEl = document.getElementById('profile-tg-id');
        const pubgIdInput = document.getElementById('profile-pubg-id-input');
        const pubgNameInput = document.getElementById('profile-pubg-name-input');
        const totalMinedEl = document.getElementById('profile-total-mined');
        const totalUcWithdrawnEl = document.getElementById('profile-total-uc');
        const referralCountEl = document.getElementById('profile-referrals');

        if (nameEl) nameEl.textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim() || `@${u.username || 'Foydalanuvchi'}`;
        if (tgIdEl) tgIdEl.textContent = `Telegram ID: ${u.telegram_id}`;
        if (pubgIdInput) pubgIdInput.value = u.pubg_id || '';
        if (pubgNameInput) pubgNameInput.value = u.pubg_name || '';
        if (totalMinedEl) totalMinedEl.textContent = Math.floor(u.total_tapped * (u.multitap_level || 1) + u.altro_balance).toLocaleString();
        if (totalUcWithdrawnEl) totalUcWithdrawnEl.textContent = `${u.total_uc_withdrawn || 0} UC`;
        if (referralCountEl) referralCountEl.textContent = `${u.referral_count || 0} ta`;

        // Load Withdrawal History
        await this.loadHistory();
    }

    async savePubgDetails() {
        const pubgId = document.getElementById('profile-pubg-id-input').value.trim();
        const pubgName = document.getElementById('profile-pubg-name-input').value.trim();

        if (!pubgId) {
            alert('Iltimos PUBG Player ID ni kiriting!');
            return;
        }

        try {
            const res = await fetch('/api/user/pubg-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    pubg_id: pubgId,
                    pubg_name: pubgName
                })
            });
            const data = await res.json();
            if (data.success) {
                window.appState.user = data.user;
                alert('PUBG ma\'lumotlari muvaffaqiyatli saqlandi! ✅');
            }
        } catch (e) {
            alert('Saqlashda xatolik yuz berdi');
        }
    }

    async loadHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;

        const userId = window.appState.user?.telegram_id;
        if (!userId) return;

        try {
            const res = await fetch(`/api/withdraw/history?telegram_id=${userId}`);
            const data = await res.json();

            if (!data.success || !data.history || data.history.length === 0) {
                container.innerHTML = `
                    <div class="p-6 text-center text-slate-500">
                        <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-600"></i>
                        <div class="text-xs">Hozircha UC yechib olinmagan</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = data.history.map(item => {
                const date = new Date(item.created_at).toLocaleDateString('uz-UZ', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let statusBadge = '';
                if (item.status === 'approved') {
                    statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><i class="fa-solid fa-check"></i> Tushirib berildi</span>';
                } else if (item.status === 'rejected') {
                    statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30"><i class="fa-solid fa-xmark"></i> Rad etildi</span>';
                } else {
                    statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"><i class="fa-solid fa-clock"></i> Kutilmoqda</span>';
                }

                return `
                    <div class="glass-panel p-3.5 border border-slate-800">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <img src="images/uc_coin.png" class="w-6 h-6 object-contain" alt="UC">
                                <span class="text-sm font-bold text-amber-300">${item.uc_amount} PUBG UC</span>
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="flex justify-between text-[11px] text-slate-400">
                            <span>PUBG ID: <b class="text-slate-200">${item.pubg_id}</b></span>
                            <span>${date}</span>
                        </div>
                        ${item.admin_note ? `
                            <div class="mt-2 text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">
                                <b>Izoh:</b> ${item.admin_note}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

        } catch (e) {
            container.innerHTML = '<div class="p-4 text-center text-red-400">Tarixni yuklab bo\'lmadi</div>';
        }
    }
}

window.profileManager = new ProfileManager();
