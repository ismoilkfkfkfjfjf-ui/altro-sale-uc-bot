// ALTRO UC BIT — Luxury Withdraw Module
class WithdrawManager {
    constructor() {
        this.selectedPackage = null;
    }

    renderPackages() {
        const container = document.getElementById('packages-grid');
        if (!container) return;

        const packages = window.appState.packages || [];
        const user = window.appState.user || { altro_balance: 0 };

        container.innerHTML = packages.map(pkg => {
            const hasEnough = user.altro_balance >= pkg.altro_cost;
            const progress = Math.min(100, Math.floor((user.altro_balance / pkg.altro_cost) * 100));

            return `
                <div class="glass-panel p-4 relative overflow-hidden transition-all duration-200 border ${
                    hasEnough ? 'border-amber-400/80 shadow-lg shadow-amber-500/20' : 'border-slate-800'
                }">
                    <!-- Top Ribbon Badge -->
                    ${pkg.badge ? `
                        <div class="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-yellow-300 border border-amber-400/50 shadow-sm">
                            ${pkg.badge}
                        </div>
                    ` : ''}
                    
                    <div class="flex items-center gap-3.5 mb-3.5">
                        <!-- Circular Medallion Icon -->
                        <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-[2.5px] shadow-lg shadow-amber-500/30 flex-shrink-0">
                            <div class="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                <img src="images/uc_coin.png" class="w-10 h-10 object-contain drop-shadow" alt="UC">
                            </div>
                        </div>

                        <div>
                            <div class="text-2xl font-black text-gold-shine tracking-tight">${pkg.uc_amount} UC</div>
                            <div class="text-xs text-slate-300 font-bold">${pkg.title || `${pkg.uc_amount} PUBG UC`}</div>
                            <div class="text-[11px] text-amber-400 font-extrabold mt-0.5">PUBG Mobile</div>
                        </div>
                    </div>

                    <!-- Progress Bar & Balance Info -->
                    <div class="space-y-1.5 mb-3.5 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80">
                        <div class="flex justify-between text-xs">
                            <span class="text-slate-400 font-medium">Kerakli Altro:</span>
                            <span class="font-black text-yellow-300 font-mono">${pkg.altro_cost.toLocaleString()} Altro</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-200 h-full rounded-full transition-all duration-300 shadow-sm shadow-amber-400" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-slate-400 font-semibold">
                            <span>Sizda: <b class="text-white">${Math.floor(user.altro_balance).toLocaleString()}</b></span>
                            <span class="text-amber-400 font-bold">${progress}%</span>
                        </div>
                    </div>

                    <!-- Withdraw Action Button -->
                    <button onclick="window.withdrawManager.openWithdrawModal(${pkg.id})" 
                            class="w-full py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                                hasEnough 
                                ? 'btn-gold-vip' 
                                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-75'
                            }">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>${hasEnough ? 'Yechib Olish' : 'Mablag\' yetarli emas'}</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    openWithdrawModal(packageId) {
        const pkg = (window.appState.packages || []).find(p => p.id === packageId);
        if (!pkg) return;

        const user = window.appState.user;
        if (user.altro_balance < pkg.altro_cost) {
            alert(`Sizda yetarli Altro UC yo'q!\nKerak: ${pkg.altro_cost.toLocaleString()} Altro UC\nSizda: ${Math.floor(user.altro_balance).toLocaleString()} Altro UC`);
            return;
        }

        this.selectedPackage = pkg;

        document.getElementById('modal-package-uc').textContent = `${pkg.uc_amount} PUBG UC`;
        document.getElementById('modal-package-cost').textContent = `${pkg.altro_cost.toLocaleString()} Altro UC`;
        
        const pubgInput = document.getElementById('modal-pubg-id');
        const nameInput = document.getElementById('modal-pubg-name');
        if (pubgInput && user.pubg_id) pubgInput.value = user.pubg_id;
        if (nameInput && user.pubg_name) nameInput.value = user.pubg_name;

        document.getElementById('withdraw-modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('withdraw-modal').classList.add('hidden');
        this.selectedPackage = null;
    }

    async submitWithdrawal() {
        if (!this.selectedPackage) return;

        const pubgId = document.getElementById('modal-pubg-id').value.trim();
        const pubgName = document.getElementById('modal-pubg-name').value.trim();

        if (!pubgId) {
            alert('Iltimos, PUBG Mobile Player ID raqamini kiriting!');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-withdraw');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Yuborilmoqda...';

        try {
            const res = await fetch('/api/withdraw/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    package_id: this.selectedPackage.id,
                    pubg_id: pubgId,
                    pubg_name: pubgName
                })
            });

            const data = await res.json();
            if (data.success) {
                if (window.soundController) window.soundController.playSuccess();
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }

                alert(`🎉 Tabriklaymiz!\n${this.selectedPackage.uc_amount} UC chiqarish arizangiz qabul qilindi!\nAdminlar tekshirib, hisobingizga tushirib berishadi.`);
                
                if (data.user) {
                    window.appState.user = data.user;
                }
                
                this.closeModal();
                window.app.updateUI();
                this.renderPackages();
                if (window.profileManager) window.profileManager.loadHistory();
            } else {
                alert(`Xatolik: ${data.message || data.error}`);
            }
        } catch (err) {
            alert('Aloqa xatoligi! Qayta urinib ko\'ring.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Tasdiqlash va Yechish';
        }
    }
}

window.withdrawManager = new WithdrawManager();
