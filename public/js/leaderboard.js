// ALTRO UC BIT — Luxury Leaderboard / Reyting Manager
class LeaderboardManager {
    async loadLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        const userRankCard = document.getElementById('user-rank-card');
        if (!container) return;

        container.innerHTML = `
            <div class="p-8 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-yellow-400 mb-2"></i>
                <div class="text-xs font-semibold">Reyting yuklanmoqda...</div>
            </div>
        `;

        try {
            const userId = window.appState.user?.telegram_id;
            const res = await fetch(`/api/leaderboard?telegram_id=${userId}`);
            const data = await res.json();

            if (!data.success) {
                container.innerHTML = '<div class="p-4 text-center text-red-400">Reytingni yuklab bo\'lmadi</div>';
                return;
            }

            const list = data.leaderboard || [];

            // Render current user rank card
            if (userRankCard && window.appState.user) {
                const u = window.appState.user;
                const myRank = data.user_rank || '100+';

                userRankCard.innerHTML = `
                    <div class="glass-panel p-4 mb-4 border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent flex items-center justify-between">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 text-black font-black flex items-center justify-center text-base shadow-lg shadow-amber-500/40 border-2 border-yellow-200">
                                #${myRank}
                            </div>
                            <div>
                                <div class="text-[10px] text-yellow-300 font-black uppercase tracking-wider">Sizning o'rningiz</div>
                                <div class="text-sm font-black text-white">${u.first_name || 'Siz'} ${u.username ? `(@${u.username})` : ''}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-base font-black text-gold-shine font-mono">${Math.floor(u.altro_balance).toLocaleString()}</div>
                            <div class="text-[10px] text-yellow-400 font-bold">Altro UC</div>
                        </div>
                    </div>
                `;
            }

            // Render top 100 list
            if (list.length === 0) {
                container.innerHTML = '<div class="p-6 text-center text-slate-400">Hozircha o\'yinchilar yo\'q</div>';
                return;
            }

            container.innerHTML = list.map((player, index) => {
                const rank = index + 1;
                let rankBadge = '';
                let borderStyle = 'border-slate-800';

                if (rank === 1) {
                    rankBadge = '<span class="text-xl">👑</span>';
                    borderStyle = 'border-amber-400/90 bg-amber-500/15 shadow-lg shadow-amber-500/20';
                } else if (rank === 2) {
                    rankBadge = '<span class="text-xl">🥈</span>';
                    borderStyle = 'border-slate-300/60 bg-slate-400/10';
                } else if (rank === 3) {
                    rankBadge = '<span class="text-xl">🥉</span>';
                    borderStyle = 'border-amber-700/60 bg-amber-800/10';
                } else {
                    rankBadge = `<span class="text-xs font-black text-slate-400 font-mono">#${rank}</span>`;
                }

                const displayName = player.first_name || (player.username ? `@${player.username}` : `Player_${player.telegram_id}`);

                return `
                    <div class="glass-panel p-3.5 flex items-center justify-between border ${borderStyle} transition-all">
                        <div class="flex items-center gap-3.5">
                            <!-- Circular Rank Badge -->
                            <div class="w-11 h-11 rounded-full bg-slate-900 border-2 ${
                                rank === 1 ? 'border-yellow-400 shadow-md shadow-yellow-400/40' : 'border-slate-700'
                            } flex items-center justify-center font-bold flex-shrink-0">
                                ${rankBadge}
                            </div>
                            <div>
                                <div class="text-xs font-black text-white flex items-center gap-1.5">
                                    <span>${displayName}</span>
                                    ${rank === 1 ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-400 text-black shadow-sm">TOP 1</span>' : ''}
                                </div>
                                <div class="text-[11px] text-slate-400 font-semibold mt-0.5">
                                    <i class="fa-solid fa-bolt text-yellow-400 text-[10px]"></i> ${player.total_tapped?.toLocaleString() || 0} bosish
                                </div>
                            </div>
                        </div>

                        <div class="text-right">
                            <div class="text-sm font-black text-gold-shine font-mono">
                                <span>${Math.floor(player.altro_balance).toLocaleString()}</span>
                            </div>
                            <div class="text-[10px] text-yellow-400 font-bold">Altro UC</div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            container.innerHTML = '<div class="p-4 text-center text-red-400">Reytingni yuklab bo\'lmadi</div>';
        }
    }
}

window.leaderboardManager = new LeaderboardManager();
