// ALTRO UC BIT — Luxury Admin PRO Panel
class AdminPanel {
    constructor() {
        this.adminId = null;
        this.activeTab = 'dashboard';
        this.packagesCache = [];
        this.channelsCache = [];
        this.tasksCache = [];
        this.currentEditPkgId = null;
        this.currentEditChanId = null;
        this.currentEditTaskId = null;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.adminId = urlParams.get('admin_id') || localStorage.getItem('altro_admin_id');

        if (!this.adminId && window.Telegram?.WebApp?.initDataUnsafe?.user) {
            this.adminId = window.Telegram.WebApp.initDataUnsafe.user.id;
        }

        if (!this.adminId) {
            const entered = prompt('Iltimos, Telegram Admin ID raqamingizni kiriting:');
            if (entered) {
                this.adminId = entered.trim();
                localStorage.setItem('altro_admin_id', this.adminId);
            } else {
                alert('Admin ID kiritilmadi!');
                window.location.href = '/';
                return;
            }
        }

        try {
            const res = await this.apiGet('/api/admin/stats');
            if (!res.success) {
                alert('Siz admin emassiz yoki ruxsat berilmagan!');
                window.location.href = '/';
                return;
            }
            
            document.getElementById('current-admin-id').textContent = `Admin ID: ${this.adminId}`;
            this.loadStats();
            this.loadPackages();
        } catch (e) {
            alert('Admin paneliga ulanishda xatolik!');
            window.location.href = '/';
        }
    }

    async apiGet(url) {
        const res = await fetch(url, {
            headers: { 'x-admin-id': this.adminId }
        });
        return await res.json();
    }

    async apiPost(url, body = {}) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': this.adminId
            },
            body: JSON.stringify({ ...body, admin_id: this.adminId })
        });
        return await res.json();
    }

    async apiPut(url, body = {}) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': this.adminId
            },
            body: JSON.stringify({ ...body, admin_id: this.adminId })
        });
        return await res.json();
    }

    async apiDelete(url) {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'x-admin-id': this.adminId }
        });
        return await res.json();
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.admin-tab-pane').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('bg-amber-500/25', 'text-yellow-300', 'border-amber-400/60'));

        const targetPane = document.getElementById(`pane-${tabId}`);
        const targetNav = document.getElementById(`nav-btn-${tabId}`);

        if (targetPane) targetPane.classList.remove('hidden');
        if (targetNav) targetNav.classList.add('bg-amber-500/25', 'text-yellow-300', 'border-amber-400/60');

        if (tabId === 'dashboard') this.loadStats();
        if (tabId === 'packages') this.loadPackages();
        if (tabId === 'withdrawals') this.loadWithdrawals();
        if (tabId === 'users') this.loadUsers();
        if (tabId === 'channels') this.loadChannels();
        if (tabId === 'tasks') this.loadTasks();
        if (tabId === 'admins') this.loadAdmins();
    }

    // 1. Dashboard Stats
    async loadStats() {
        const data = await this.apiGet('/api/admin/stats');
        if (data.success) {
            const s = data.stats;
            document.getElementById('stat-total-users').textContent = s.total_users.toLocaleString();
            document.getElementById('stat-total-altro').textContent = s.total_altro.toLocaleString();
            document.getElementById('stat-total-uc').textContent = `${s.total_uc_withdrawn.toLocaleString()} UC`;
            document.getElementById('stat-pending-withdrawals').textContent = s.pending_withdrawals.toLocaleString();
        }
    }

    // 2. UC Packages (Nechta UC beradiganini sozlash & TAHRIRLASH)
    async loadPackages() {
        const data = await this.apiGet('/api/admin/packages');
        const list = document.getElementById('packages-admin-list');
        if (!list) return;

        if (!data.success || data.packages.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Paketlar mavjud emas</td></tr>';
            return;
        }

        this.packagesCache = data.packages;

        list.innerHTML = data.packages.map(pkg => `
            <tr class="border-b border-slate-800/80 hover:bg-slate-900/60 transition-all">
                <td class="p-3.5 font-black text-yellow-300 font-mono text-sm">${pkg.uc_amount} UC</td>
                <td class="p-3.5 font-mono text-white font-bold">${pkg.altro_cost.toLocaleString()} Altro</td>
                <td class="p-3.5 text-slate-200 font-medium">${pkg.title || '-'}</td>
                <td class="p-3.5">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-yellow-300 border border-amber-400/40">${pkg.badge || 'Oddiy'}</span>
                </td>
                <td class="p-3.5 text-right space-x-1.5">
                    <button onclick="window.adminPanel.openEditPackageModal(${pkg.id})" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-yellow-300 hover:bg-amber-500/30 text-xs font-black border border-amber-400/40">
                        <i class="fa-solid fa-pen-to-square"></i> Tahrirlash
                    </button>
                    <button onclick="window.adminPanel.deletePackage(${pkg.id})" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-black border border-rose-500/30">
                        <i class="fa-solid fa-trash"></i> O'chirish
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async addPackage() {
        const altroCost = parseInt(document.getElementById('pkg-altro-cost').value);
        const ucAmount = parseInt(document.getElementById('pkg-uc-amount').value);
        const title = document.getElementById('pkg-title').value.trim();
        const badge = document.getElementById('pkg-badge').value.trim();

        if (!altroCost || !ucAmount) {
            alert('Altro narxi va UC miqdorini to\'liq kiriting!');
            return;
        }

        const data = await this.apiPost('/api/admin/packages', {
            altro_cost: altroCost,
            uc_amount: ucAmount,
            title,
            badge
        });

        if (data.success) {
            alert('Yangi paket muvaffaqiyatli qo\'shildi! ✅');
            document.getElementById('pkg-altro-cost').value = '';
            document.getElementById('pkg-uc-amount').value = '';
            document.getElementById('pkg-title').value = '';
            document.getElementById('pkg-badge').value = '';
            this.loadPackages();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    openEditPackageModal(id) {
        const pkg = this.packagesCache.find(p => p.id === id);
        if (!pkg) return;

        this.currentEditPkgId = id;
        document.getElementById('edit-pkg-altro').value = pkg.altro_cost;
        document.getElementById('edit-pkg-uc').value = pkg.uc_amount;
        document.getElementById('edit-pkg-title').value = pkg.title || '';
        document.getElementById('edit-pkg-badge').value = pkg.badge || '';
        document.getElementById('edit-package-modal').classList.remove('hidden');
    }

    closeEditPackageModal() {
        document.getElementById('edit-package-modal').classList.add('hidden');
        this.currentEditPkgId = null;
    }

    async savePackageEdit() {
        if (!this.currentEditPkgId) return;

        const altroCost = parseInt(document.getElementById('edit-pkg-altro').value);
        const ucAmount = parseInt(document.getElementById('edit-pkg-uc').value);
        const title = document.getElementById('edit-pkg-title').value.trim();
        const badge = document.getElementById('edit-pkg-badge').value.trim();

        if (!altroCost || !ucAmount) {
            alert('Barcha maydonlarni to\'ldiring!');
            return;
        }

        const data = await this.apiPut(`/api/admin/packages/${this.currentEditPkgId}`, {
            altro_cost: altroCost,
            uc_amount: ucAmount,
            title,
            badge
        });

        if (data.success) {
            alert('Paket muvaffaqiyatli yangilandi! ✅');
            this.closeEditPackageModal();
            this.loadPackages();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    async deletePackage(id) {
        if (!confirm('Haqiqatan ham bu paketni o\'chirmoqchimisiz?')) return;
        const data = await this.apiDelete(`/api/admin/packages/${id}`);
        if (data.success) {
            this.loadPackages();
        }
    }

    // 3. Withdrawal Requests
    async loadWithdrawals(status = null) {
        const url = status ? `/api/admin/withdrawals?status=${status}` : '/api/admin/withdrawals';
        const data = await this.apiGet(url);
        const list = document.getElementById('withdrawals-admin-list');
        if (!list) return;

        if (!data.success || data.withdrawals.length === 0) {
            list.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-500">Arizalar mavjud emas</td></tr>';
            return;
        }

        list.innerHTML = data.withdrawals.map(w => {
            const date = new Date(w.created_at).toLocaleDateString('uz-UZ', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            let statusBadge = '';
            if (w.status === 'approved') {
                statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ Tushirildi</span>';
            } else if (w.status === 'rejected') {
                statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">❌ Rad etildi</span>';
            } else {
                statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-yellow-300 border border-amber-400/40">⏳ Kutilmoqda</span>';
            }

            return `
                <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition-all">
                    <td class="p-3.5 text-slate-400 font-mono text-xs">#${w.id}</td>
                    <td class="p-3.5">
                        <div class="text-xs font-black text-white">${w.first_name || 'Foydalanuvchi'}</div>
                        <div class="text-[10px] text-yellow-400/80 font-mono">ID: ${w.user_id}</div>
                    </td>
                    <td class="p-3.5 font-mono font-black text-yellow-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-400/30 inline-block">${w.pubg_id}</td>
                    <td class="p-3.5 font-black text-white text-sm font-mono">${w.uc_amount} UC</td>
                    <td class="p-3.5 text-xs text-slate-400 font-medium">${date}</td>
                    <td class="p-3.5">${statusBadge}</td>
                    <td class="p-3.5 text-right space-x-1.5">
                        ${w.status === 'pending' ? `
                            <button onclick="window.adminPanel.updateWithdrawalStatus(${w.id}, 'approved')" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-black border border-emerald-500/40">
                                <i class="fa-solid fa-check"></i> Tasdiqlash
                            </button>
                            <button onclick="window.adminPanel.promptRejectWithdrawal(${w.id})" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-black border border-rose-500/40">
                                <i class="fa-solid fa-xmark"></i> Rad etish
                            </button>
                        ` : '<span class="text-xs text-slate-500 font-semibold">Bajarilgan</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async updateWithdrawalStatus(id, status, note = '') {
        const data = await this.apiPost(`/api/admin/withdrawals/${id}/status`, { status, note });
        if (data.success) {
            alert(`Ariza holati yangilandi: ${status === 'approved' ? 'Tasdiqlandi va bot orqali tabriknoma yuborildi! ✅' : 'Rad etildi va Altro qaytarildi! ❌'}`);
            this.loadWithdrawals();
            this.loadStats();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    promptRejectWithdrawal(id) {
        const note = prompt('Rad etish sababini kiriting (mijozga yuboriladi):', 'Noto\'g\'ri PUBG ID raqami kiritilgan');
        if (note !== null) {
            this.updateWithdrawalStatus(id, 'rejected', note);
        }
    }

    // 4. Users & Balance Management (30,000+ support)
    async loadUsers() {
        const query = document.getElementById('user-search-input')?.value.trim() || '';
        const data = await this.apiGet(`/api/admin/users?q=${encodeURIComponent(query)}`);
        const list = document.getElementById('users-admin-list');
        if (!list) return;

        if (!data.success || data.users.length === 0) {
            list.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">Foydalanuvchilar topilmadi</td></tr>';
            return;
        }

        list.innerHTML = data.users.map(u => `
            <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition-all">
                <td class="p-3.5 font-mono text-xs text-yellow-300 font-bold">${u.telegram_id}</td>
                <td class="p-3.5">
                    <div class="text-xs font-black text-white">${u.first_name || ''} ${u.last_name || ''}</div>
                    <div class="text-[10px] text-slate-400">${u.username ? '@' + u.username : '-'}</div>
                </td>
                <td class="p-3.5 font-mono text-xs text-white font-semibold">${u.pubg_id || '-'}</td>
                <td class="p-3.5 font-black text-yellow-300 font-mono">${Math.floor(u.altro_balance).toLocaleString()}</td>
                <td class="p-3.5 font-mono text-xs text-slate-400">${u.total_tapped?.toLocaleString() || 0}</td>
                <td class="p-3.5 text-right">
                    <button onclick="window.adminPanel.editBalance(${u.telegram_id}, ${u.altro_balance})" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-yellow-300 hover:bg-amber-500/30 text-xs font-black border border-amber-400/40">
                        <i class="fa-solid fa-pen"></i> Balansni o'zgartirish
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async editBalance(tgId, currentBalance) {
        const newBal = prompt(`Foydalanuvchi (${tgId}) uchun yangi Altro UC balansini kiriting:`, currentBalance);
        if (newBal === null) return;

        const altroNum = parseFloat(newBal);
        if (isNaN(altroNum)) {
            alert('Faqat son kiriting!');
            return;
        }

        const data = await this.apiPost('/api/admin/users/balance', {
            telegram_id: tgId,
            altro_balance: altroNum
        });

        if (data.success) {
            alert('Balans muvaffaqiyatli yangilandi! ✅');
            this.loadUsers();
            this.loadStats();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    // 5. Mandatory Channels (SOZLASH VA TAHRIRLASH)
    async loadChannels() {
        const data = await this.apiGet('/api/admin/channels');
        const list = document.getElementById('channels-admin-list');
        if (!list) return;

        if (!data.success || data.channels.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Majburiy kanallar kiritilmagan</td></tr>';
            return;
        }

        this.channelsCache = data.channels;

        list.innerHTML = data.channels.map(ch => `
            <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition-all">
                <td class="p-3.5 font-black text-white">${ch.title}</td>
                <td class="p-3.5 text-yellow-300 font-mono text-xs">${ch.channel_username}</td>
                <td class="p-3.5 text-slate-300 text-xs"><a href="${ch.invite_link}" target="_blank" class="underline text-yellow-400 font-bold">Havola</a></td>
                <td class="p-3.5 text-right space-x-1.5">
                    <button onclick="window.adminPanel.openEditChannelModal(${ch.id})" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-yellow-300 hover:bg-amber-500/30 text-xs font-black border border-amber-400/40">
                        <i class="fa-solid fa-pen-to-square"></i> Tahrirlash
                    </button>
                    <button onclick="window.adminPanel.deleteChannel(${ch.id})" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/30">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async addChannel() {
        const title = document.getElementById('chan-title').value.trim();
        const username = document.getElementById('chan-username').value.trim();
        const inviteLink = document.getElementById('chan-link').value.trim();

        if (!title || !username || !inviteLink) {
            alert('Barcha maydonlarni to\'ldiring!');
            return;
        }

        const data = await this.apiPost('/api/admin/channels', {
            title,
            channel_username: username,
            invite_link: inviteLink
        });

        if (data.success) {
            alert('Kanal muvaffaqiyatli qo\'shildi! ✅');
            document.getElementById('chan-title').value = '';
            document.getElementById('chan-username').value = '';
            document.getElementById('chan-link').value = '';
            this.loadChannels();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    openEditChannelModal(id) {
        const ch = this.channelsCache.find(c => c.id === id);
        if (!ch) return;

        this.currentEditChanId = id;
        document.getElementById('edit-chan-title').value = ch.title;
        document.getElementById('edit-chan-username').value = ch.channel_username;
        document.getElementById('edit-chan-link').value = ch.invite_link;
        document.getElementById('edit-channel-modal').classList.remove('hidden');
    }

    closeEditChannelModal() {
        document.getElementById('edit-channel-modal').classList.add('hidden');
        this.currentEditChanId = null;
    }

    async saveChannelEdit() {
        if (!this.currentEditChanId) return;

        const title = document.getElementById('edit-chan-title').value.trim();
        const username = document.getElementById('edit-chan-username').value.trim();
        const inviteLink = document.getElementById('edit-chan-link').value.trim();

        if (!title || !username || !inviteLink) {
            alert('Barcha maydonlarni to\'ldiring!');
            return;
        }

        const data = await this.apiPut(`/api/admin/channels/${this.currentEditChanId}`, {
            title,
            channel_username: username,
            invite_link: inviteLink
        });

        if (data.success) {
            alert('Kanal muvaffaqiyatli tahrirlandi! ✅');
            this.closeEditChannelModal();
            this.loadChannels();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    async deleteChannel(id) {
        if (!confirm('Kanalni o\'chirmoqchimisiz?')) return;
        const data = await this.apiDelete(`/api/admin/channels/${id}`);
        if (data.success) this.loadChannels();
    }

    // 6. Tasks Management (TAHRIRLASH)
    async loadTasks() {
        const data = await this.apiGet('/api/admin/tasks');
        const list = document.getElementById('tasks-admin-list');
        if (!list) return;

        if (!data.success || data.tasks.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Vazifalar yo\'q</td></tr>';
            return;
        }

        this.tasksCache = data.tasks;

        list.innerHTML = data.tasks.map(t => `
            <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition-all">
                <td class="p-3.5 font-black text-white">${t.title}</td>
                <td class="p-3.5 text-xs uppercase font-mono text-yellow-300 font-bold">${t.type}</td>
                <td class="p-3.5 font-black text-yellow-300 font-mono">+${t.reward_altro.toLocaleString()}</td>
                <td class="p-3.5 text-xs text-slate-300"><a href="${t.link}" target="_blank" class="underline text-yellow-400 font-bold">Havola</a></td>
                <td class="p-3.5 text-right space-x-1.5">
                    <button onclick="window.adminPanel.openEditTaskModal(${t.id})" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-yellow-300 hover:bg-amber-500/30 text-xs font-black border border-amber-400/40">
                        <i class="fa-solid fa-pen-to-square"></i> Tahrirlash
                    </button>
                    <button onclick="window.adminPanel.deleteTask(${t.id})" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/30">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async addTask() {
        const title = document.getElementById('task-title').value.trim();
        const type = document.getElementById('task-type').value;
        const reward = parseInt(document.getElementById('task-reward').value);
        const link = document.getElementById('task-link').value.trim();

        if (!title || !reward || !link) {
            alert('Sarlavha, mukofot va havolani kiriting!');
            return;
        }

        const icon = type === 'youtube' ? 'fa-brands fa-youtube text-red-500' : 'fa-solid fa-gift text-yellow-400';

        const data = await this.apiPost('/api/admin/tasks', {
            title,
            type,
            reward_altro: reward,
            link,
            icon
        });

        if (data.success) {
            alert('Vazifa muvaffaqiyatli qo\'shildi! ✅');
            document.getElementById('task-title').value = '';
            document.getElementById('task-reward').value = '200';
            document.getElementById('task-link').value = '';
            this.loadTasks();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    openEditTaskModal(id) {
        const t = this.tasksCache.find(item => item.id === id);
        if (!t) return;

        this.currentEditTaskId = id;
        document.getElementById('edit-task-title').value = t.title;
        document.getElementById('edit-task-reward').value = t.reward_altro;
        document.getElementById('edit-task-link').value = t.link;
        document.getElementById('edit-task-modal').classList.remove('hidden');
    }

    closeEditTaskModal() {
        document.getElementById('edit-task-modal').classList.add('hidden');
        this.currentEditTaskId = null;
    }

    async saveTaskEdit() {
        if (!this.currentEditTaskId) return;

        const title = document.getElementById('edit-task-title').value.trim();
        const reward = parseInt(document.getElementById('edit-task-reward').value);
        const link = document.getElementById('edit-task-link').value.trim();

        if (!title || !reward || !link) {
            alert('Barcha maydonlarni to\'ldiring!');
            return;
        }

        const data = await this.apiPut(`/api/admin/tasks/${this.currentEditTaskId}`, {
            title,
            description: '',
            reward_altro: reward,
            link
        });

        if (data.success) {
            alert('Vazifa muvaffaqiyatli yangilandi! ✅');
            this.closeEditTaskModal();
            this.loadTasks();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    async deleteTask(id) {
        if (!confirm('Vazifani o\'chirmoqchimisiz?')) return;
        const data = await this.apiDelete(`/api/admin/tasks/${id}`);
        if (data.success) this.loadTasks();
    }

    // 7. Admins Management
    async loadAdmins() {
        const data = await this.apiGet('/api/admin/admins');
        const list = document.getElementById('admins-list');
        if (!list) return;

        if (!data.success || data.admins.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Adminlar yo\'q</td></tr>';
            return;
        }

        list.innerHTML = data.admins.map(a => {
            const isOwner = a.role === 'owner' || a.role === 'ega';
            return `
            <tr class="border-b border-slate-800 hover:bg-slate-900/60 transition-all">
                <td class="p-3.5 font-mono font-bold text-yellow-300">${a.telegram_id}</td>
                <td class="p-3.5 text-xs font-bold">
                    ${isOwner ? '<span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-yellow-300 border border-amber-500/40">👑 Ega (Owner)</span>' : '<span class="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">🛡️ Admin</span>'}
                </td>
                <td class="p-3.5 text-xs text-slate-300">${a.note || '-'}</td>
                <td class="p-3.5 text-right">
                    ${isOwner ? '<span class="text-xs text-slate-500 italic">Asosiy Ega</span>' : `
                    <button onclick="window.adminPanel.deleteAdmin(${a.telegram_id})" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/30 hover:bg-rose-500/30">
                        <i class="fa-solid fa-user-minus"></i> O'chirish
                    </button>
                    `}
                </td>
            </tr>
            `;
        }).join('');
    }

    async addAdmin() {
        const newId = document.getElementById('new-admin-id').value.trim();
        const note = document.getElementById('new-admin-note').value.trim();

        if (!newId || isNaN(newId)) {
            alert('Yaroqli Telegram ID kiriting!');
            return;
        }

        const data = await this.apiPost('/api/admin/admins', {
            new_admin_id: parseInt(newId),
            note
        });

        if (data.success) {
            alert('Yangi admin qo\'shildi! 👑');
            document.getElementById('new-admin-id').value = '';
            document.getElementById('new-admin-note').value = '';
            this.loadAdmins();
        } else {
            alert(data.error || 'Xatolik');
        }
    }

    async deleteAdmin(id) {
        if (!confirm('Adminni o\'chirmoqchimisiz?')) return;
        const data = await this.apiDelete(`/api/admin/admins/${id}`);
        if (data.success) this.loadAdmins();
    }

    // 8. Broadcast
    async sendBroadcast() {
        const msg = document.getElementById('broadcast-text').value.trim();
        const photo = document.getElementById('broadcast-photo').value.trim();

        if (!msg) {
            alert('Xabar matnini kiriting!');
            return;
        }

        if (!confirm('Bu xabar botning barcha foydalanuvchilariga yuboriladi. Tasdiqlaysizmi?')) return;

        const btn = document.getElementById('btn-send-broadcast');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...';

        const data = await this.apiPost('/api/admin/broadcast', {
            message: msg,
            photo_url: photo || null
        });

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Xabarni Barchaga Yuborish';

        if (data.success) {
            alert(`Xabar tarqatildi!\nYetkazildi: ${data.result.sent} ta\nXatolik: ${data.result.failed} ta`);
            document.getElementById('broadcast-text').value = '';
            document.getElementById('broadcast-photo').value = '';
        } else {
            alert(data.error || 'Xatolik');
        }
    }
}

window.adminPanel = new AdminPanel();
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel.init();
});
