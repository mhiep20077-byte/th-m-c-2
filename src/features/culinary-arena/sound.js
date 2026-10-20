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