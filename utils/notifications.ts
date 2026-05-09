
/**
 * Utility for generating alarm sounds and vibrations
 */

export const playSound = (type: 'ready' | 'new_order' | 'kitchen', durationSeconds = 1) => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Ensure context is running (fixes background/idle issues)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const playTone = (freq: number, oscType: OscillatorType, startTime: number, duration: number, volume = 0.3) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = oscType;
            oscillator.frequency.setValueAtTime(freq, startTime);

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration + 0.1);
            return oscillator;
        };

        const now = ctx.currentTime;

        if (type === 'ready') {
            // "TIMBRE DE ESCUELA": High volume, rapid square wave pulses for 10 seconds
            const totalDuration = 10;
            const volume = 0.6; // Double the average volume
            for (let i = 0; i < totalDuration; i += 0.15) {
                // High frequency oscillating pulses
                const freq = i % 0.3 < 0.15 ? 1200 : 1500;
                playTone(freq, 'square', now + i, 0.1, volume);
            }
        } else if (type === 'new_order') {
            // CAJERO: Different Tone, 5 seconds
            const totalDuration = 5;
            const volume = 0.4;
            for (let i = 0; i < totalDuration; i += 0.5) {
                // Alternating high tones
                playTone(880, 'sine', now + i, 0.2, volume);
                playTone(1100, 'sine', now + i + 0.25, 0.2, volume);
            }
        } else if (type === 'kitchen') {
            // COCINA: Different Tone, 5 seconds
            const totalDuration = 5;
            const volume = 0.4;
            for (let i = 0; i < totalDuration; i += 0.8) {
                // Lower mechanical-like double beep
                playTone(440, 'sawtooth', now + i, 0.3, volume * 0.5);
                playTone(523, 'sine', now + i + 0.3, 0.4, volume);
            }
        }
    } catch (e) {
        console.error("Audio playback error", e);
    }
};

export const triggerVibration = (type: 'ready' | 'new_order' | 'kitchen', durationSeconds = 1) => {
    if (!('vibrate' in navigator)) return;

    if (type === 'ready') {
        // Intensive vibration for client ready
        const pattern = [];
        for (let i = 0; i < (durationSeconds * 1000) / 400; i++) {
            pattern.push(300, 100);
        }
        navigator.vibrate(pattern);
    } else if (type === 'new_order') {
        // Quick pulses for cashier
        navigator.vibrate([100, 50, 100, 50, 100]);
    } else if (type === 'kitchen') {
        // Standard kitchen notification vibration
        navigator.vibrate([200, 100, 200]);
    }
};
