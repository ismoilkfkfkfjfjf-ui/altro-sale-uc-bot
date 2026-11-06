// ALTRO SALE UC BOT — Ultra-Smooth Fast Game Engine (60+ FPS)
class GameEngine {
    constructor() {
        this.coinCircle = null;
        this.coinContainer = null;
        this.pendingEnergyUsed = 0;
        this.syncTimer = null;
        this.energyTicker = null;
        this.isSyncing = false;
        this.lastSoundTime = 0;
        this.lastHapticTime = 0;
        this.activeParticles = [];
    }

    init() {
        this.coinCircle = document.getElementById('coin-circle');
        this.coinContainer = document.getElementById('coin-container');
        this.bindEvents();
        this.startEnergyTicker();
    }

    bindEvents() {
        if (!this.coinContainer) return;

        // Multi-touch support with high performance
        this.coinContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                this.handleTap(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        // Mouse click for desktop preview
        this.coinContainer.addEventListener('mousedown', (e) => {
            this.handleTap(e.clientX, e.clientY);
        });
    }

    handleTap(clientX, clientY) {
        const u = window.appState.user;
        if (!u) return;

        const multitap = u.multitap_level || 1;
        // Exact energy rule: deduct whatever amount is gained
        const gain = Math.min(u.current_energy, multitap);

        if (gain <= 0) {
            this.wobbleEnergyBar();
            this.playErrorHaptic();
            return;
        }

        // Deduct energy & grant Altro exactly 1:1
        u.current_energy -= gain;
        u.altro_balance += gain;
        u.total_tapped = (u.total_tapped || 0) + gain;
        this.pendingEnergyUsed += gain;

        // Visual effects (Lightweight & optimized for 60fps)
        this.showFloatingNumber(clientX, clientY, `+${gain}`);
        this.playTapFeedback();

        // Update UI directly & fast
        if (window.app) {
            window.app.updateUI();
        }

        // Batch sync with server
        this.scheduleSync();
    }

    wobbleEnergyBar() {
        const container = document.getElementById('energy-container');
        if (container && !container.classList.contains('animate-shake')) {
            container.classList.add('animate-shake');
            setTimeout(() => container.classList.remove('animate-shake'), 350);
        }
    }

    playErrorHaptic() {
        const now = Date.now();
        if (now - this.lastHapticTime > 200) {
            this.lastHapticTime = now;
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
        }
    }

    playTapFeedback() {
        const now = Date.now();

        // Throttled sound (prevents audio node overload)
        if (now - this.lastSoundTime > 75) {
            this.lastSoundTime = now;
            if (window.soundController) {
                window.soundController.playTap();
            }
        }

        // Throttled haptic (prevents Telegram WebView lag)
        if (now - this.lastHapticTime > 80) {
            this.lastHapticTime = now;
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }

        // Coin bounce animation
        if (this.coinCircle) {
            this.coinCircle.classList.add('tapped');
            setTimeout(() => {
                if (this.coinCircle) this.coinCircle.classList.remove('tapped');
            }, 60);
        }
    }

    showFloatingNumber(x, y, text) {
        // Prevent DOM bloating: remove oldest if > 10 particles
        if (this.activeParticles.length > 10) {
            const old = this.activeParticles.shift();
            if (old && old.parentNode) old.parentNode.removeChild(old);
        }

        const particle = document.createElement('div');
        particle.className = 'tap-particle';
        particle.textContent = text;

        if (x && y) {
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
        } else if (this.coinContainer) {
            const rect = this.coinContainer.getBoundingClientRect();
            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;
        }

        document.body.appendChild(particle);
        this.activeParticles.push(particle);

        setTimeout(() => {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
            const idx = this.activeParticles.indexOf(particle);
            if (idx > -1) this.activeParticles.splice(idx, 1);
        }, 700);
    }

    scheduleSync() {
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncWithServer();
        }, 1000);
    }

    async syncWithServer() {
        if (this.pendingEnergyUsed <= 0 || this.isSyncing) return;

        const energyToSend = this.pendingEnergyUsed;
        this.pendingEnergyUsed = 0;
        this.isSyncing = true;

        try {
            const res = await fetch('/api/user/tap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    taps: energyToSend
                })
            });

            const data = await res.json();
            if (data.success) {
                window.appState.user.altro_balance = data.altro_balance;
                window.appState.user.current_energy = data.current_energy;
                if (window.app) window.app.updateUI();
            }
        } catch (err) {
            // Re-queue on network error
            this.pendingEnergyUsed += energyToSend;
        } finally {
            this.isSyncing = false;
        }
    }

    startEnergyTicker() {
        if (this.energyTicker) clearInterval(this.energyTicker);
        this.energyTicker = setInterval(() => {
            const u = window.appState.user;
            if (!u) return;

            const maxEnergy = u.max_energy || 1000;
            const rechargeRate = 1 + ((u.recharge_speed_level || 1) - 1) * 1;

            if (u.current_energy < maxEnergy) {
                u.current_energy = Math.min(maxEnergy, u.current_energy + rechargeRate);
                if (window.app) window.app.updateEnergyUI();
            }
        }, 1000);
    }
}

window.gameEngine = new GameEngine();
