// ALTRO UC BIT — Luxury $1000 Game Engine
class GameEngine {
    constructor() {
        this.coinCircle = null;
        this.coinContainer = null;
        this.pendingTaps = 0;
        this.syncTimer = null;
        this.energyTicker = null;
        this.isSyncing = false;
    }

    init() {
        this.coinCircle = document.getElementById('coin-circle');
        this.coinContainer = document.getElementById('coin-container');
        this.bindEvents();
        this.startEnergyTicker();
    }

    bindEvents() {
        if (!this.coinContainer) return;

        // Multi-touch support (2, 3, 4 fingers at once!)
        this.coinContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                this.handleTap(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        // Mouse click support for PC / Preview
        this.coinContainer.addEventListener('mousedown', (e) => {
            this.handleTap(e.clientX, e.clientY);
        });

        // 3D Perspective Tilt on move
        this.coinContainer.addEventListener('mousemove', (e) => {
            this.apply3DTilt(e.clientX, e.clientY);
        });

        this.coinContainer.addEventListener('mouseleave', () => {
            this.reset3DTilt();
        });
    }

    apply3DTilt(clientX, clientY) {
        if (!this.coinCircle) return;
        const rect = this.coinContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = (clientX - centerX) / (rect.width / 2);
        const deltaY = (clientY - centerY) / (rect.height / 2);

        const tiltX = -deltaY * 22; // Max 22 deg
        const tiltY = deltaX * 22;

        this.coinCircle.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.96)`;
    }

    reset3DTilt() {
        if (!this.coinCircle) return;
        this.coinCircle.style.transform = `perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)`;
    }

    handleTap(clientX, clientY) {
        const u = window.appState.user;
        if (!u) return;

        const earnPerTap = u.multitap_level || 1;
        const energyRequired = 1;

        // Energy verification
        if (u.current_energy < energyRequired) {
            this.wobbleEnergyBar();
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            return;
        }

        // Local optimistic deduct
        u.current_energy = Math.max(0, u.current_energy - energyRequired);
        u.altro_balance += earnPerTap;
        u.total_tapped = (u.total_tapped || 0) + 1;
        this.pendingTaps += 1;

        // Visual effects
        this.createTapRipple(clientX, clientY);
        this.createFloatingNumber(clientX, clientY, `+${earnPerTap}`);
        this.playTapEffects(clientX, clientY);

        // Update UI
        window.app.updateUI();

        // Batch sync with server
        this.scheduleSync();
    }

    wobbleEnergyBar() {
        const container = document.getElementById('energy-container');
        if (container) {
            container.classList.add('animate-shake');
            setTimeout(() => container.classList.remove('animate-shake'), 400);
        }
    }

    playTapEffects(x, y) {
        // High fidelity audio
        if (window.soundController) {
            window.soundController.playTap();
        }

        // Telegram Haptic
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }

        // Circular Medallion bounce animation
        if (this.coinCircle) {
            this.coinCircle.classList.add('tapped');
            setTimeout(() => this.coinCircle.classList.remove('tapped'), 80);
        }

        // Gold Sparkle Particles
        this.createSparks(x, y);
    }

    createTapRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'tap-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    }

    createFloatingNumber(x, y, text) {
        const particle = document.createElement('div');
        particle.className = 'tap-particle';
        particle.textContent = text;

        if (x && y) {
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
        } else {
            const rect = this.coinContainer.getBoundingClientRect();
            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;
        }

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 850);
    }

    createSparks(x, y) {
        const count = 6;
        for (let i = 0; i < count; i++) {
            const spark = document.createElement('div');
            spark.style.position = 'fixed';
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.width = '7px';
            spark.style.height = '7px';
            spark.style.backgroundColor = '#fef08a';
            spark.style.borderRadius = '50%';
            spark.style.pointerEvents = 'none';
            spark.style.boxShadow = '0 0 10px #fbbf24, 0 0 16px #f59e0b';
            spark.style.zIndex = '9998';

            const angle = Math.random() * Math.PI * 2;
            const velocity = 40 + Math.random() * 55;
            const destX = Math.cos(angle) * velocity;
            const destY = Math.sin(angle) * velocity;

            spark.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${destX}px, ${destY}px) scale(0)`, opacity: 0 }
            ], {
                duration: 450 + Math.random() * 200,
                easing: 'cubic-bezier(0, .9, .57, 1)'
            });

            document.body.appendChild(spark);
            setTimeout(() => spark.remove(), 600);
        }
    }

    scheduleSync() {
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncWithServer();
        }, 1200);
    }

    async syncWithServer() {
        if (this.pendingTaps <= 0 || this.isSyncing) return;

        const tapsToSend = this.pendingTaps;
        this.pendingTaps = 0;
        this.isSyncing = true;

        try {
            const res = await fetch('/api/user/tap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_id: window.appState.user.telegram_id,
                    taps: tapsToSend
                })
            });

            const data = await res.json();
            if (data.success) {
                window.appState.user.altro_balance = data.altro_balance;
                window.appState.user.current_energy = data.current_energy;
                window.app.updateUI();
            }
        } catch (err) {
            this.pendingTaps += tapsToSend;
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
                window.app.updateEnergyUI();
            }
        }, 1000);
    }
}

window.gameEngine = new GameEngine();
