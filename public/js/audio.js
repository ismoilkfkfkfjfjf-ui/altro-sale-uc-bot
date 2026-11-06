// ALTRO UC BIT — Luxury Arcade Web Audio Synthesizer
class SoundController {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('sound_muted') === 'true';
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('sound_muted', this.muted);
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // Rich double-harmonic metallic gold coin clink
    playTap() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            // 1. High Crystal Ping
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            const freq1 = 1800 + Math.random() * 200;

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq1, now);
            osc1.frequency.exponentialRampToValueAtTime(3200, now + 0.04);

            gain1.gain.setValueAtTime(0.25, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.08);

            // 2. Metallic Golden Ring
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            const freq2 = 2400 + Math.random() * 150;

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq2, now);
            osc2.frequency.exponentialRampToValueAtTime(800, now + 0.06);

            gain2.gain.setValueAtTime(0.15, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);

            osc2.start(now);
            osc2.stop(now + 0.06);
        } catch (e) {}
    }

    // Victory fanfare on successful UC withdraw or task completion
    playSuccess() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 (Royal Gold chord)
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.value = freq;

                const startTime = this.ctx.currentTime + idx * 0.08;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.32);
            });
        } catch (e) {}
    }

    // Power-up level upgrade sound
    playUpgrade() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.2); // C6

            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) {}
    }
}

window.soundController = new SoundController();
