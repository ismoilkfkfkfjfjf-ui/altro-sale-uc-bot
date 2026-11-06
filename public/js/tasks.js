// ALTRO UC BIT — Luxury Tasks / Shartlar Manager
class TasksManager {
    constructor() {
        this.verifyingTasks = new Set();
    }

    renderTasks() {
        const container = document.getElementById('tasks-list');
        if (!container) return;

        const tasks = window.appState.tasks || [];

        container.innerHTML = tasks.map(task => {
            const isCompleted = task.is_completed;
            const isVerifying = this.verifyingTasks.has(task.id);

            return `
                <div class="glass-panel p-4 flex items-center justify-between gap-3 border ${
                    isCompleted ? 'border-emerald-500/40 bg-emerald-950/15' : 'border-slate-800 hover:border-amber-400/40'
                } transition-all">
                    <div class="flex items-center gap-3.5">
                        <!-- Circular Task Icon -->
                        <div class="w-12 h-12 rounded-full bg-slate-900 border-2 border-amber-400/50 flex items-center justify-center text-xl shadow-md shadow-amber-500/20 flex-shrink-0">
                            <i class="${task.icon || 'fa-solid fa-gift text-yellow-400'}"></i>
                        </div>
                        <div>
                            <div class="text-xs font-black text-white">${task.title}</div>
                            <div class="text-[11px] text-slate-400 mb-1">${task.description || ''}</div>
                            <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-yellow-300 border border-amber-400/40 shadow-sm">
                                <span>+${task.reward_altro.toLocaleString()} Altro UC</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        ${isCompleted ? `
                            <div class="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>Tayyor</span>
                            </div>
                        ` : isVerifying ? `
                            <button disabled class="px-3.5 py-2 rounded-full bg-amber-500/30 text-yellow-300 text-xs font-black flex items-center gap-2">
                                <i class="fa-solid fa-spinner fa-spin"></i>
                                <span>Kutilmoqda</span>
                            </button>
                        ` : `
                            <button onclick="window.tasksManager.startTask(${task.id})" class="btn-gold-vip px-4 py-2 rounded-full text-xs font-black flex items-center gap-1.5">
                                <span>Bajarish</span>
                                <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    startTask(taskId) {
        const task = (window.appState.tasks || []).find(t => t.id === taskId);
        if (!task) return;

        if (task.link && task.link.startsWith('http')) {
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.openLink(task.link);
            } else {
                window.open(task.link, '_blank');
            }
        } else if (task.type === 'referral') {
            window.app.switchTab('referral');
            return;
        }

        this.verifyingTasks.add(taskId);
        this.renderTasks();

        setTimeout(async () => {
            await this.claimReward(taskId);
        }, 4000);
    }

    async claimReward(taskId) {
        try {
            const res = await fetch('/api/tasks/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    task_id: taskId
                })
            });

            const data = await res.json();
            this.verifyingTasks.delete(taskId);

            if (data.success) {
                if (window.soundController) window.soundController.playSuccess();
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }

                alert(`🎉 Tabriklaymiz!\nVazifa bajarildi va +${data.reward} Altro UC hisobingizga qo'shildi!`);
                window.appState.user.altro_balance = data.newBalance;
                
                const task = window.appState.tasks.find(t => t.id === taskId);
                if (task) task.is_completed = true;

                window.app.updateUI();
                this.renderTasks();
            } else {
                this.renderTasks();
                alert(data.message || 'Xatolik yuz berdi');
            }
        } catch (e) {
            this.verifyingTasks.delete(taskId);
            this.renderTasks();
            alert('Aloqa xatoligi!');
        }
    }
}

window.tasksManager = new TasksManager();
