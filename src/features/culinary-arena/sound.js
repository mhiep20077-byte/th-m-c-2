/**
 * =========================================================================
 * BỘ ÂM THANH CHIÊM TINH ẨM THỰC (CULINARY ORACLE SYNTHESIZER)
 * Tự sinh âm thanh huyền bí 100% bằng Web Audio API
 * =========================================================================
 */

let audioCtx = null;
let soundEnabled = true;

const SOUND_STORAGE_KEY = 'culinary-oracle-sound-enabled';

try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved !== null) {
        soundEnabled = saved === 'true';
    }
} catch (_) { }

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function isSoundEnabled() {
    return soundEnabled;
}

export function toggleSound(forcedState) {
    soundEnabled = forcedState !== undefined ? Boolean(forcedState) : !soundEnabled;
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    } catch (_) { }
    return soundEnabled;
}

/**
 * Tiếng click nảy thanh thoát
 */
export function playUiClick() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
}

/**
 * Tiếng xào bài lật thẻ (Card Shuffle / Flip whoosh)
 */
export function playCardFlip() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(2800, now + 0.07);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.15);
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.15);
}

/**
 * Tiếng chuông pha lê ngân nga khi lá bài Tarot lật mở thần kỳ
 */
export function playOracleChime() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Hợp âm ngũ cung thanh khiết: D5, F#5, A5, D6, F#6
    const notes = [587.33, 739.99, 880.00, 1174.66, 1479.98];

    notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.12, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.7);
    });
}

/**
 * Tiếng chuông ngân khải hoàn khi toàn bộ quẻ bói được khai mở
 */
export function playRevelationGong() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [392.00, 493.88, 587.33, 783.99]; // Sol trưởng ấm áp

    chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.15, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + 1.2);
    });
}
